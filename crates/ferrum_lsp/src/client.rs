//! LSP client implementation
//!
//! Handles JSON-RPC communication with language servers.

use ferrum_core::prelude::*;
use lsp_types::{
  ClientCapabilities, CompletionItem, CompletionParams, CompletionResponse,
  DidChangeTextDocumentParams, DidCloseTextDocumentParams, DidOpenTextDocumentParams,
  DocumentSymbolParams, DocumentSymbolResponse, GotoDefinitionParams, GotoDefinitionResponse,
  Hover, HoverParams, InitializeParams, InitializeResult, InitializedParams, Location,
  ReferenceParams, ServerCapabilities, TextDocumentClientCapabilities,
  TextDocumentContentChangeEvent, TextDocumentIdentifier, TextDocumentItem,
  TextDocumentPositionParams, TextDocumentSyncClientCapabilities, Uri,
  VersionedTextDocumentIdentifier,
  notification::{DidChangeTextDocument, DidCloseTextDocument, DidOpenTextDocument, Initialized},
  request::{
    Completion, DocumentSymbolRequest, GotoDefinition, HoverRequest, Initialize, References,
  },
};
use parking_lot::{Mutex, RwLock};
use serde::{Serialize, de::DeserializeOwned};
use serde_json::{Value, json};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, BufWriter, Read, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::Arc;
use std::sync::atomic::{AtomicI64, Ordering};
use std::time::Duration;
use tokio::sync::oneshot;
use tracing::{debug, error, info};

/// LSP client state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LspClientState {
  /// Not started
  Stopped,
  /// Starting up
  Starting,
  /// Running and ready
  Running,
  /// Shutting down
  ShuttingDown,
  /// Server crashed or errored
  Failed,
}

/// LSP client for a single language server
pub struct LspClient {
  language: String,
  state: RwLock<LspClientState>,
  next_request_id: AtomicI64,
  capabilities: RwLock<Option<ServerCapabilities>>,

  // Process handles
  process: Mutex<Option<Child>>,
  stdin: Mutex<Option<BufWriter<ChildStdin>>>,

  // Pending request handlers
  pending_requests: Arc<Mutex<HashMap<i64, oneshot::Sender<Result<Value>>>>>,

  // Root path for the workspace
  root_path: RwLock<Option<PathBuf>>,
}

impl LspClient {
  /// Create a new LSP client
  pub fn new(language: impl Into<String>) -> Self {
    Self {
      language: language.into(),
      state: RwLock::new(LspClientState::Stopped),
      next_request_id: AtomicI64::new(1),
      capabilities: RwLock::new(None),
      process: Mutex::new(None),
      stdin: Mutex::new(None),
      pending_requests: Arc::new(Mutex::new(HashMap::new())),
      root_path: RwLock::new(None),
    }
  }

  /// Get the language
  pub fn language(&self) -> &str {
    &self.language
  }

  /// Get the current state
  pub fn state(&self) -> LspClientState {
    *self.state.read()
  }

  /// Check if initialized
  pub fn is_initialized(&self) -> bool {
    *self.state.read() == LspClientState::Running
  }

  /// Get server capabilities
  pub fn capabilities(&self) -> Option<ServerCapabilities> {
    self.capabilities.read().clone()
  }

  /// Start the language server
  pub async fn start(&self, command: &str, args: &[&str], root_path: PathBuf) -> Result<()> {
    // Update state
    *self.state.write() = LspClientState::Starting;
    *self.root_path.write() = Some(root_path.clone());

    // Spawn the server process
    let mut process = Command::new(command)
      .args(args)
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()
      .map_err(|e| Error::Internal(format!("Failed to start LSP server: {}", e)))?;

    let stdin = process.stdin.take().unwrap();
    let stdout = process.stdout.take().unwrap();

    // Store handles
    *self.stdin.lock() = Some(BufWriter::new(stdin));
    *self.process.lock() = Some(process);

    // Start reading responses in background
    let pending = self.pending_requests.clone();
    std::thread::spawn(move || {
      let reader = BufReader::new(stdout);
      Self::read_loop(reader, pending);
    });

    // Send initialize request
    let init_result = self.initialize(&root_path).await?;
    *self.capabilities.write() = Some(init_result.capabilities);

    // Send initialized notification
    self.send_notification::<Initialized>(InitializedParams {})?;

    *self.state.write() = LspClientState::Running;
    info!("LSP server started for {}", self.language);

    Ok(())
  }

  /// Stop the language server
  pub async fn stop(&self) -> Result<()> {
    if *self.state.read() != LspClientState::Running {
      return Ok(());
    }

    *self.state.write() = LspClientState::ShuttingDown;

    // Send shutdown request
    let _: Value = self.request_raw("shutdown", Value::Null).await?;

    // Send exit notification
    self.send_notification_raw("exit", Value::Null)?;

    // Kill process
    if let Some(mut process) = self.process.lock().take() {
      let _ = process.kill();
    }

    *self.state.write() = LspClientState::Stopped;
    info!("LSP server stopped for {}", self.language);

    Ok(())
  }

  /// Initialize the server
  async fn initialize(&self, root_path: &PathBuf) -> Result<InitializeResult> {
    let root_uri: Uri = format!("file://{}", root_path.to_string_lossy())
      .parse()
      .unwrap();

    // Use workspace_folders instead of deprecated root_path/root_uri
    let workspace_folder = lsp_types::WorkspaceFolder {
      uri: root_uri,
      name: root_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "workspace".to_string()),
    };

    #[allow(deprecated)]
    let params = InitializeParams {
      process_id: Some(std::process::id()),
      // These fields are deprecated but some LSP servers still require them
      root_path: None,
      root_uri: None,
      initialization_options: None,
      capabilities: self.client_capabilities(),
      trace: None,
      workspace_folders: Some(vec![workspace_folder]),
      client_info: Some(lsp_types::ClientInfo {
        name: "Ferrum IDE".to_string(),
        version: Some(env!("CARGO_PKG_VERSION").to_string()),
      }),
      locale: None,
      work_done_progress_params: Default::default(),
    };

    self.request::<Initialize>(params).await
  }

  /// Get client capabilities
  fn client_capabilities(&self) -> ClientCapabilities {
    ClientCapabilities {
      text_document: Some(TextDocumentClientCapabilities {
        synchronization: Some(TextDocumentSyncClientCapabilities {
          dynamic_registration: Some(false),
          will_save: Some(true),
          will_save_wait_until: Some(false),
          did_save: Some(true),
        }),
        completion: Some(lsp_types::CompletionClientCapabilities {
          dynamic_registration: Some(false),
          completion_item: Some(lsp_types::CompletionItemCapability {
            snippet_support: Some(true),
            commit_characters_support: Some(true),
            documentation_format: Some(vec![
              lsp_types::MarkupKind::Markdown,
              lsp_types::MarkupKind::PlainText,
            ]),
            deprecated_support: Some(true),
            preselect_support: Some(true),
            ..Default::default()
          }),
          ..Default::default()
        }),
        hover: Some(lsp_types::HoverClientCapabilities {
          dynamic_registration: Some(false),
          content_format: Some(vec![
            lsp_types::MarkupKind::Markdown,
            lsp_types::MarkupKind::PlainText,
          ]),
        }),
        definition: Some(lsp_types::GotoCapability {
          dynamic_registration: Some(false),
          link_support: Some(true),
        }),
        references: Some(lsp_types::DynamicRegistrationClientCapabilities {
          dynamic_registration: Some(false),
        }),
        document_symbol: Some(lsp_types::DocumentSymbolClientCapabilities {
          dynamic_registration: Some(false),
          symbol_kind: None,
          hierarchical_document_symbol_support: Some(true),
          ..Default::default()
        }),
        ..Default::default()
      }),
      ..Default::default()
    }
  }

  // ========== Document Synchronization ==========

  /// Notify server that a document was opened
  pub fn did_open(&self, uri: Uri, language_id: &str, version: i32, text: &str) -> Result<()> {
    let params = DidOpenTextDocumentParams {
      text_document: TextDocumentItem {
        uri,
        language_id: language_id.to_string(),
        version,
        text: text.to_string(),
      },
    };
    self.send_notification::<DidOpenTextDocument>(params)
  }

  /// Notify server that a document was changed
  pub fn did_change(
    &self,
    uri: Uri,
    version: i32,
    changes: Vec<TextDocumentContentChangeEvent>,
  ) -> Result<()> {
    let params = DidChangeTextDocumentParams {
      text_document: VersionedTextDocumentIdentifier { uri, version },
      content_changes: changes,
    };
    self.send_notification::<DidChangeTextDocument>(params)
  }

  /// Notify server that a document was closed
  pub fn did_close(&self, uri: Uri) -> Result<()> {
    let params = DidCloseTextDocumentParams {
      text_document: TextDocumentIdentifier { uri },
    };
    self.send_notification::<DidCloseTextDocument>(params)
  }

  // ========== Language Features ==========

  /// Request completion at position
  pub async fn completion(
    &self,
    uri: Uri,
    position: lsp_types::Position,
  ) -> Result<Vec<CompletionItem>> {
    let params = CompletionParams {
      text_document_position: TextDocumentPositionParams {
        text_document: TextDocumentIdentifier { uri },
        position,
      },
      work_done_progress_params: Default::default(),
      partial_result_params: Default::default(),
      context: None,
    };

    let response: Option<CompletionResponse> = self.request::<Completion>(params).await?;

    Ok(match response {
      Some(CompletionResponse::Array(items)) => items,
      Some(CompletionResponse::List(list)) => list.items,
      None => Vec::new(),
    })
  }

  /// Request hover information
  pub async fn hover(&self, uri: Uri, position: lsp_types::Position) -> Result<Option<Hover>> {
    let params = HoverParams {
      text_document_position_params: TextDocumentPositionParams {
        text_document: TextDocumentIdentifier { uri },
        position,
      },
      work_done_progress_params: Default::default(),
    };

    self.request::<HoverRequest>(params).await
  }

  /// Go to definition
  pub async fn goto_definition(
    &self,
    uri: Uri,
    position: lsp_types::Position,
  ) -> Result<Vec<Location>> {
    let params = GotoDefinitionParams {
      text_document_position_params: TextDocumentPositionParams {
        text_document: TextDocumentIdentifier { uri },
        position,
      },
      work_done_progress_params: Default::default(),
      partial_result_params: Default::default(),
    };

    let response: Option<GotoDefinitionResponse> = self.request::<GotoDefinition>(params).await?;

    Ok(match response {
      Some(GotoDefinitionResponse::Scalar(loc)) => vec![loc],
      Some(GotoDefinitionResponse::Array(locs)) => locs,
      Some(GotoDefinitionResponse::Link(links)) => links
        .into_iter()
        .map(|l| Location {
          uri: l.target_uri,
          range: l.target_selection_range,
        })
        .collect(),
      None => Vec::new(),
    })
  }

  /// Find references
  pub async fn references(
    &self,
    uri: Uri,
    position: lsp_types::Position,
    include_declaration: bool,
  ) -> Result<Vec<Location>> {
    let params = ReferenceParams {
      text_document_position: TextDocumentPositionParams {
        text_document: TextDocumentIdentifier { uri },
        position,
      },
      work_done_progress_params: Default::default(),
      partial_result_params: Default::default(),
      context: lsp_types::ReferenceContext {
        include_declaration,
      },
    };

    let response: Option<Vec<Location>> = self.request::<References>(params).await?;
    Ok(response.unwrap_or_default())
  }

  /// Get document symbols
  pub async fn document_symbols(&self, uri: Uri) -> Result<DocumentSymbolResponse> {
    let params = DocumentSymbolParams {
      text_document: TextDocumentIdentifier { uri },
      work_done_progress_params: Default::default(),
      partial_result_params: Default::default(),
    };

    let response: Option<DocumentSymbolResponse> =
      self.request::<DocumentSymbolRequest>(params).await?;
    Ok(response.unwrap_or(DocumentSymbolResponse::Flat(Vec::new())))
  }

  // ========== JSON-RPC Communication ==========

  /// Send a request and wait for response (typed)
  async fn request<R>(&self, params: R::Params) -> Result<R::Result>
  where
    R: lsp_types::request::Request,
    R::Params: Serialize,
    R::Result: DeserializeOwned,
  {
    self
      .request_raw(R::METHOD, serde_json::to_value(params).unwrap())
      .await
  }

  /// Send a raw request with method string
  async fn request_raw<T: DeserializeOwned>(&self, method: &str, params: Value) -> Result<T> {
    let id = self.next_request_id.fetch_add(1, Ordering::SeqCst);

    // Create response channel
    let (tx, rx) = oneshot::channel();
    self.pending_requests.lock().insert(id, tx);

    // Build message
    let message = json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params,
    });

    // Send request
    self.send_message(&message)?;

    // Wait for response with timeout
    let result = tokio::time::timeout(Duration::from_secs(120), rx)
      .await
      .map_err(|_| Error::Internal("LSP request timeout".to_string()))?
      .map_err(|_| Error::Internal("LSP response channel closed".to_string()))??;

    serde_json::from_value(result)
      .map_err(|e| Error::Internal(format!("Failed to parse LSP response: {}", e)))
  }

  /// Send a notification (no response expected)
  fn send_notification<N>(&self, params: N::Params) -> Result<()>
  where
    N: lsp_types::notification::Notification,
    N::Params: Serialize,
  {
    self.send_notification_raw(N::METHOD, serde_json::to_value(params).unwrap())
  }

  /// Send a raw notification
  fn send_notification_raw(&self, method: &str, params: Value) -> Result<()> {
    let message = json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
    });

    self.send_message(&message)
  }

  /// Send a JSON-RPC message
  fn send_message(&self, message: &Value) -> Result<()> {
    let content = serde_json::to_string(message).unwrap();
    let header = format!("Content-Length: {}\r\n\r\n", content.len());

    let mut stdin = self.stdin.lock();
    if let Some(ref mut writer) = *stdin {
      writer
        .write_all(header.as_bytes())
        .map_err(|e| Error::Internal(format!("Failed to write to LSP: {}", e)))?;
      writer
        .write_all(content.as_bytes())
        .map_err(|e| Error::Internal(format!("Failed to write to LSP: {}", e)))?;
      writer
        .flush()
        .map_err(|e| Error::Internal(format!("Failed to flush LSP: {}", e)))?;
      Ok(())
    } else {
      Err(Error::Internal("LSP server not running".to_string()))
    }
  }

  /// Background thread to read responses
  fn read_loop(
    mut reader: BufReader<ChildStdout>,
    pending: Arc<Mutex<HashMap<i64, oneshot::Sender<Result<Value>>>>>,
  ) {
    loop {
      // Read Content-Length header
      let mut header = String::new();
      if reader.read_line(&mut header).is_err() {
        break;
      }

      if !header.starts_with("Content-Length:") {
        continue;
      }

      let length: usize = header
        .trim_start_matches("Content-Length:")
        .trim()
        .parse()
        .unwrap_or(0);

      if length == 0 {
        continue;
      }

      // Skip empty line
      let mut empty = String::new();
      let _ = reader.read_line(&mut empty);

      // Read content
      let mut content = vec![0u8; length];
      if reader.read_exact(&mut content).is_err() {
        break;
      }

      // Parse JSON
      let message: Value = match serde_json::from_slice(&content) {
        Ok(v) => v,
        Err(e) => {
          error!("Failed to parse LSP message: {}", e);
          continue;
        },
      };

      // Handle response
      if let Some(id) = message.get("id").and_then(|v| v.as_i64()) {
        let result = if let Some(error) = message.get("error") {
          Err(Error::Internal(format!("LSP error: {}", error)))
        } else {
          Ok(message.get("result").cloned().unwrap_or(Value::Null))
        };

        if let Some(tx) = pending.lock().remove(&id) {
          let _ = tx.send(result);
        }
      } else if let Some(method) = message.get("method").and_then(|v| v.as_str()) {
        // Handle notifications/requests from server
        debug!("LSP notification: {}", method);
        // TODO: Handle diagnostics, progress, etc.
      }
    }
  }
}

impl Drop for LspClient {
  fn drop(&mut self) {
    // Kill the process if still running
    if let Some(mut process) = self.process.lock().take() {
      let _ = process.kill();
    }
  }
}
