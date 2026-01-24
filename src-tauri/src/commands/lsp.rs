//! LSP-related Tauri commands

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;
use tracing::{error, info};

// ========== Helper Functions ==========

/// Convert CompletionItemKind to u32
fn completion_item_kind_to_u32(kind: lsp_types::CompletionItemKind) -> u32 {
  match kind {
    lsp_types::CompletionItemKind::TEXT => 1,
    lsp_types::CompletionItemKind::METHOD => 2,
    lsp_types::CompletionItemKind::FUNCTION => 3,
    lsp_types::CompletionItemKind::CONSTRUCTOR => 4,
    lsp_types::CompletionItemKind::FIELD => 5,
    lsp_types::CompletionItemKind::VARIABLE => 6,
    lsp_types::CompletionItemKind::CLASS => 7,
    lsp_types::CompletionItemKind::INTERFACE => 8,
    lsp_types::CompletionItemKind::MODULE => 9,
    lsp_types::CompletionItemKind::PROPERTY => 10,
    lsp_types::CompletionItemKind::UNIT => 11,
    lsp_types::CompletionItemKind::VALUE => 12,
    lsp_types::CompletionItemKind::ENUM => 13,
    lsp_types::CompletionItemKind::KEYWORD => 14,
    lsp_types::CompletionItemKind::SNIPPET => 15,
    lsp_types::CompletionItemKind::COLOR => 16,
    lsp_types::CompletionItemKind::FILE => 17,
    lsp_types::CompletionItemKind::REFERENCE => 18,
    lsp_types::CompletionItemKind::FOLDER => 19,
    lsp_types::CompletionItemKind::ENUM_MEMBER => 20,
    lsp_types::CompletionItemKind::CONSTANT => 21,
    lsp_types::CompletionItemKind::STRUCT => 22,
    lsp_types::CompletionItemKind::EVENT => 23,
    lsp_types::CompletionItemKind::OPERATOR => 24,
    lsp_types::CompletionItemKind::TYPE_PARAMETER => 25,
    _ => 0,
  }
}

/// Convert SymbolKind to u32
fn symbol_kind_to_u32(kind: lsp_types::SymbolKind) -> u32 {
  match kind {
    lsp_types::SymbolKind::FILE => 1,
    lsp_types::SymbolKind::MODULE => 2,
    lsp_types::SymbolKind::NAMESPACE => 3,
    lsp_types::SymbolKind::PACKAGE => 4,
    lsp_types::SymbolKind::CLASS => 5,
    lsp_types::SymbolKind::METHOD => 6,
    lsp_types::SymbolKind::PROPERTY => 7,
    lsp_types::SymbolKind::FIELD => 8,
    lsp_types::SymbolKind::CONSTRUCTOR => 9,
    lsp_types::SymbolKind::ENUM => 10,
    lsp_types::SymbolKind::INTERFACE => 11,
    lsp_types::SymbolKind::FUNCTION => 12,
    lsp_types::SymbolKind::VARIABLE => 13,
    lsp_types::SymbolKind::CONSTANT => 14,
    lsp_types::SymbolKind::STRING => 15,
    lsp_types::SymbolKind::NUMBER => 16,
    lsp_types::SymbolKind::BOOLEAN => 17,
    lsp_types::SymbolKind::ARRAY => 18,
    lsp_types::SymbolKind::OBJECT => 19,
    lsp_types::SymbolKind::KEY => 20,
    lsp_types::SymbolKind::NULL => 21,
    lsp_types::SymbolKind::ENUM_MEMBER => 22,
    lsp_types::SymbolKind::STRUCT => 23,
    lsp_types::SymbolKind::EVENT => 24,
    lsp_types::SymbolKind::OPERATOR => 25,
    lsp_types::SymbolKind::TYPE_PARAMETER => 26,
    _ => 0,
  }
}

// ========== Types ==========

/// Position in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
  pub line: u32,
  pub character: u32,
}

impl From<lsp_types::Position> for Position {
  fn from(p: lsp_types::Position) -> Self {
    Self {
      line: p.line,
      character: p.character,
    }
  }
}

impl From<Position> for lsp_types::Position {
  fn from(p: Position) -> Self {
    Self {
      line: p.line,
      character: p.character,
    }
  }
}

/// Range in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
  pub start: Position,
  pub end: Position,
}

impl From<lsp_types::Range> for Range {
  fn from(r: lsp_types::Range) -> Self {
    Self {
      start: r.start.into(),
      end: r.end.into(),
    }
  }
}

/// Location (file + range)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
  pub uri: String,
  pub range: Range,
}

impl From<lsp_types::Location> for Location {
  fn from(l: lsp_types::Location) -> Self {
    Self {
      uri: l.uri.to_string(),
      range: l.range.into(),
    }
  }
}

/// Completion item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
  pub label: String,
  pub kind: u32,
  pub detail: Option<String>,
  pub documentation: Option<String>,
  pub insert_text: Option<String>,
  pub sort_text: Option<String>,
}

impl From<lsp_types::CompletionItem> for CompletionItem {
  fn from(item: lsp_types::CompletionItem) -> Self {
    let documentation = item.documentation.map(|doc| match doc {
      lsp_types::Documentation::String(s) => s,
      lsp_types::Documentation::MarkupContent(m) => m.value,
    });

    Self {
      label: item.label,
      kind: item.kind.map(completion_item_kind_to_u32).unwrap_or(0),
      detail: item.detail,
      documentation,
      insert_text: item.insert_text,
      sort_text: item.sort_text,
    }
  }
}

/// Hover result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverResult {
  pub contents: String,
  pub range: Option<Range>,
}

impl From<lsp_types::Hover> for HoverResult {
  fn from(hover: lsp_types::Hover) -> Self {
    let contents = match hover.contents {
      lsp_types::HoverContents::Scalar(m) => match m {
        lsp_types::MarkedString::String(s) => s,
        lsp_types::MarkedString::LanguageString(ls) => ls.value,
      },
      lsp_types::HoverContents::Array(arr) => arr
        .into_iter()
        .map(|m| match m {
          lsp_types::MarkedString::String(s) => s,
          lsp_types::MarkedString::LanguageString(ls) => ls.value,
        })
        .collect::<Vec<_>>()
        .join("\n\n"),
      lsp_types::HoverContents::Markup(m) => m.value,
    };

    Self {
      contents,
      range: hover.range.map(Into::into),
    }
  }
}

/// Diagnostic severity
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[repr(u8)]
#[allow(dead_code)]
pub enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

/// Diagnostic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
  pub range: Range,
  pub severity: u8,
  pub code: Option<String>,
  pub source: Option<String>,
  pub message: String,
}

/// Symbol information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolInfo {
  pub name: String,
  pub kind: u32,
  pub range: Range,
  pub selection_range: Range,
  pub children: Option<Vec<SymbolInfo>>,
}

impl From<lsp_types::DocumentSymbol> for SymbolInfo {
  fn from(sym: lsp_types::DocumentSymbol) -> Self {
    Self {
      name: sym.name,
      kind: symbol_kind_to_u32(sym.kind),
      range: sym.range.into(),
      selection_range: sym.selection_range.into(),
      children: sym.children.map(|c| c.into_iter().map(Into::into).collect()),
    }
  }
}

/// LSP server status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspStatus {
  pub language: String,
  pub running: bool,
  pub initialized: bool,
}

/// Helper to get file URI from path
fn file_uri(path: &str) -> lsp_types::Uri {
  format!("file://{}", path).parse().unwrap()
}

/// Helper to detect language from file path
fn detect_language(path: &str) -> Option<String> {
  let ext = std::path::Path::new(path)
    .extension()
    .and_then(|e| e.to_str())?;

  match ext {
    "ts" | "tsx" | "js" | "jsx" | "mjs" | "cjs" => Some("typescript".to_string()),
    "rs" => Some("rust".to_string()),
    "py" | "pyi" => Some("python".to_string()),
    "go" => Some("go".to_string()),
    "c" | "cpp" | "cc" | "h" | "hpp" => Some("cpp".to_string()),
    "json" | "jsonc" => Some("json".to_string()),
    "html" | "htm" => Some("html".to_string()),
    "css" | "scss" | "less" => Some("css".to_string()),
    "yaml" | "yml" => Some("yaml".to_string()),
    "toml" => Some("toml".to_string()),
    "md" | "markdown" => Some("markdown".to_string()),
    "lua" => Some("lua".to_string()),
    "zig" => Some("zig".to_string()),
    "svelte" => Some("svelte".to_string()),
    "vue" => Some("vue".to_string()),
    "sh" | "bash" => Some("bash".to_string()),
    _ => None,
  }
}

/// Start an LSP server for a language
#[tauri::command]
pub async fn lsp_start(
  state: State<'_, AppState>,
  language: String,
  root_path: String,
) -> Result<LspStatus, String> {
  info!("Starting LSP server for language: {}", language);

  let path = PathBuf::from(&root_path);
  match state.lsp.start(&language, path).await {
    Ok(_client) => Ok(LspStatus {
      language,
      running: true,
      initialized: true,
    }),
    Err(e) => {
      error!("Failed to start LSP server: {}", e);
      Err(format!("Failed to start LSP server: {}", e))
    },
  }
}

/// Stop an LSP server
#[tauri::command]
pub async fn lsp_stop(state: State<'_, AppState>, language: String) -> Result<(), String> {
  info!("Stopping LSP server for language: {}", language);
  state.lsp.stop(&language).await.map_err(|e| e.to_string())
}

/// Get LSP server status
#[tauri::command]
pub fn lsp_status(state: State<'_, AppState>, language: String) -> LspStatus {
  let running = state.lsp.is_running(&language);
  LspStatus {
    language,
    running,
    initialized: running,
  }
}

/// Request completions at a position
#[tauri::command]
pub async fn lsp_completion(
  state: State<'_, AppState>,
  file_path: String,
  line: u32,
  character: u32,
) -> Result<Vec<CompletionItem>, String> {
  let language = detect_language(&file_path).ok_or("Unknown language")?;

  let client = state
    .lsp
    .get_client(&language)
    .ok_or_else(|| format!("LSP not running for {}", language))?;

  let uri = file_uri(&file_path);
  let position = lsp_types::Position { line, character };

  match client.completion(uri, position).await {
    Ok(items) => Ok(items.into_iter().map(Into::into).collect()),
    Err(e) => {
      error!("LSP completion failed: {}", e);
      Err(e.to_string())
    },
  }
}

/// Request hover information
#[tauri::command]
pub async fn lsp_hover(
  state: State<'_, AppState>,
  file_path: String,
  line: u32,
  character: u32,
) -> Result<Option<HoverResult>, String> {
  let language = detect_language(&file_path).ok_or("Unknown language")?;

  let client = state
    .lsp
    .get_client(&language)
    .ok_or_else(|| format!("LSP not running for {}", language))?;

  let uri = file_uri(&file_path);
  let position = lsp_types::Position { line, character };

  match client.hover(uri, position).await {
    Ok(hover) => Ok(hover.map(Into::into)),
    Err(e) => {
      error!("LSP hover failed: {}", e);
      Err(e.to_string())
    },
  }
}

/// Go to definition
#[tauri::command]
pub async fn lsp_goto_definition(
  state: State<'_, AppState>,
  file_path: String,
  line: u32,
  character: u32,
) -> Result<Vec<Location>, String> {
  let language = detect_language(&file_path).ok_or("Unknown language")?;

  let client = state
    .lsp
    .get_client(&language)
    .ok_or_else(|| format!("LSP not running for {}", language))?;

  let uri = file_uri(&file_path);
  let position = lsp_types::Position { line, character };

  match client.goto_definition(uri, position).await {
    Ok(locations) => Ok(locations.into_iter().map(Into::into).collect()),
    Err(e) => {
      error!("LSP goto definition failed: {}", e);
      Err(e.to_string())
    },
  }
}

/// Find references
#[tauri::command]
pub async fn lsp_references(
  state: State<'_, AppState>,
  file_path: String,
  line: u32,
  character: u32,
  include_declaration: bool,
) -> Result<Vec<Location>, String> {
  let language = detect_language(&file_path).ok_or("Unknown language")?;

  let client = state
    .lsp
    .get_client(&language)
    .ok_or_else(|| format!("LSP not running for {}", language))?;

  let uri = file_uri(&file_path);
  let position = lsp_types::Position { line, character };

  match client.references(uri, position, include_declaration).await {
    Ok(locations) => Ok(locations.into_iter().map(Into::into).collect()),
    Err(e) => {
      error!("LSP references failed: {}", e);
      Err(e.to_string())
    },
  }
}

/// Get document symbols
#[tauri::command]
pub async fn lsp_document_symbols(
  state: State<'_, AppState>,
  file_path: String,
) -> Result<Vec<SymbolInfo>, String> {
  let language = detect_language(&file_path).ok_or("Unknown language")?;

  let client = state
    .lsp
    .get_client(&language)
    .ok_or_else(|| format!("LSP not running for {}", language))?;

  let uri = file_uri(&file_path);

  match client.document_symbols(uri).await {
    Ok(response) => {
      let symbols = match response {
        lsp_types::DocumentSymbolResponse::Flat(syms) => syms
          .into_iter()
          .map(|s| SymbolInfo {
            name: s.name,
            kind: symbol_kind_to_u32(s.kind),
            range: s.location.range.into(),
            selection_range: s.location.range.into(),
            children: None,
          })
          .collect(),
        lsp_types::DocumentSymbolResponse::Nested(syms) => {
          syms.into_iter().map(Into::into).collect()
        },
      };
      Ok(symbols)
    },
    Err(e) => {
      error!("LSP document symbols failed: {}", e);
      Err(e.to_string())
    },
  }
}

/// Get diagnostics for a file
#[tauri::command]
pub fn lsp_diagnostics(_state: State<'_, AppState>, _file_path: String) -> Vec<Diagnostic> {
  // TODO: Return cached diagnostics from LSP client
  // Diagnostics are pushed from server, need to implement caching
  Vec::new()
}

/// Notify LSP that a file was opened
#[tauri::command]
pub async fn lsp_did_open(
  state: State<'_, AppState>,
  file_path: String,
  language_id: String,
  version: i32,
  content: String,
) -> Result<(), String> {
  // Try to get or start the LSP client
  let client = if let Some(c) = state.lsp.get_client(&language_id) {
    c
  } else {
    // Try to detect root path from file path
    let path = PathBuf::from(&file_path);
    let root = path.parent().unwrap_or(&path).to_path_buf();
    state
      .lsp
      .start(&language_id, root)
      .await
      .map_err(|e| e.to_string())?
  };

  let uri = file_uri(&file_path);
  client
    .did_open(uri, &language_id, version, &content)
    .map_err(|e| e.to_string())
}

/// Notify LSP that a file was changed
#[tauri::command]
pub async fn lsp_did_change(
  state: State<'_, AppState>,
  file_path: String,
  version: i32,
  content: String,
) -> Result<(), String> {
  let language = detect_language(&file_path).ok_or("Unknown language")?;

  let client = state
    .lsp
    .get_client(&language)
    .ok_or_else(|| format!("LSP not running for {}", language))?;

  let uri = file_uri(&file_path);
  let changes = vec![lsp_types::TextDocumentContentChangeEvent {
    range: None,
    range_length: None,
    text: content,
  }];

  client.did_change(uri, version, changes).map_err(|e| e.to_string())
}

/// Notify LSP that a file was saved
#[tauri::command]
pub async fn lsp_did_save(_state: State<'_, AppState>, _file_path: String) -> Result<(), String> {
  // TODO: Implement did_save notification
  // Need to add did_save method to LspClient
  Ok(())
}

/// Notify LSP that a file was closed
#[tauri::command]
pub async fn lsp_did_close(
  state: State<'_, AppState>,
  file_path: String,
) -> Result<(), String> {
  let language = detect_language(&file_path).ok_or("Unknown language")?;

  if let Some(client) = state.lsp.get_client(&language) {
    let uri = file_uri(&file_path);
    client.did_close(uri).map_err(|e| e.to_string())
  } else {
    Ok(()) // No client running, nothing to do
  }
}

/// Text edit for rename operations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextEdit {
  pub range: Range,
  pub new_text: String,
}

/// Rename a symbol
#[tauri::command]
pub async fn lsp_rename(
  state: State<'_, AppState>,
  file_path: String,
  line: u32,
  character: u32,
  new_name: String,
) -> Result<Vec<TextEdit>, String> {
  let language = detect_language(&file_path).ok_or("Unknown language")?;

  let client = state
    .lsp
    .get_client(&language)
    .ok_or_else(|| format!("LSP not running for {}", language))?;

  let uri = file_uri(&file_path);
  let position = lsp_types::Position { line, character };

  match client.rename(uri, position, &new_name).await {
    Ok(workspace_edit) => {
      let mut edits = Vec::new();

      if let Some(changes) = workspace_edit.changes {
        for (_uri, file_edits) in changes {
          for edit in file_edits {
            edits.push(TextEdit {
              range: edit.range.into(),
              new_text: edit.new_text,
            });
          }
        }
      }

      Ok(edits)
    },
    Err(e) => {
      error!("LSP rename failed: {}", e);
      Err(e.to_string())
    },
  }
}
