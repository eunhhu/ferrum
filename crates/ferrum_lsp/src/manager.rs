//! LSP server manager
//!
//! Manages multiple LSP servers for different languages.

use dashmap::DashMap;
use ferrum_core::prelude::*;
use std::path::PathBuf;
use std::sync::Arc;
use tracing::{info, warn};

use crate::client::{LspClient, LspClientState};

/// LSP server configuration for a language
#[derive(Debug, Clone)]
pub struct LspServerConfig {
  /// Language identifier
  pub language_id: String,
  /// Command to run the LSP server
  pub command: String,
  /// Arguments for the command
  pub args: Vec<String>,
  /// File extensions this server handles
  pub extensions: Vec<String>,
}

impl LspServerConfig {
  /// Create a new LSP server config
  pub fn new(language_id: &str, command: &str, args: Vec<&str>, extensions: Vec<&str>) -> Self {
    Self {
      language_id: language_id.to_string(),
      command: command.to_string(),
      args: args.into_iter().map(String::from).collect(),
      extensions: extensions.into_iter().map(String::from).collect(),
    }
  }
}

/// Get default LSP server configurations for common languages
pub fn default_lsp_configs() -> Vec<LspServerConfig> {
  vec![
    // TypeScript/JavaScript - typescript-language-server
    LspServerConfig::new(
      "typescript",
      "typescript-language-server",
      vec!["--stdio"],
      vec!["ts", "tsx", "js", "jsx", "mjs", "cjs"],
    ),
    // Rust - rust-analyzer
    LspServerConfig::new("rust", "rust-analyzer", vec![], vec!["rs"]),
    // Python - pyright
    LspServerConfig::new(
      "python",
      "pyright-langserver",
      vec!["--stdio"],
      vec!["py", "pyi"],
    ),
    // Go - gopls
    LspServerConfig::new("go", "gopls", vec![], vec!["go"]),
    // C/C++ - clangd
    LspServerConfig::new("cpp", "clangd", vec![], vec!["c", "cpp", "cc", "h", "hpp"]),
    // JSON - vscode-json-languageserver
    LspServerConfig::new(
      "json",
      "vscode-json-language-server",
      vec!["--stdio"],
      vec!["json", "jsonc"],
    ),
    // HTML - vscode-html-languageserver
    LspServerConfig::new(
      "html",
      "vscode-html-language-server",
      vec!["--stdio"],
      vec!["html", "htm"],
    ),
    // CSS - vscode-css-languageserver
    LspServerConfig::new(
      "css",
      "vscode-css-language-server",
      vec!["--stdio"],
      vec!["css", "scss", "less"],
    ),
    // YAML - yaml-language-server
    LspServerConfig::new(
      "yaml",
      "yaml-language-server",
      vec!["--stdio"],
      vec!["yaml", "yml"],
    ),
    // TOML - taplo
    LspServerConfig::new("toml", "taplo", vec!["lsp", "stdio"], vec!["toml"]),
    // Markdown - marksman
    LspServerConfig::new("markdown", "marksman", vec!["server"], vec!["md", "markdown"]),
    // Lua - lua-language-server
    LspServerConfig::new("lua", "lua-language-server", vec![], vec!["lua"]),
    // Zig - zls
    LspServerConfig::new("zig", "zls", vec![], vec!["zig"]),
    // Svelte - svelte-language-server
    LspServerConfig::new(
      "svelte",
      "svelteserver",
      vec!["--stdio"],
      vec!["svelte"],
    ),
    // Vue - vue-language-server
    LspServerConfig::new("vue", "vue-language-server", vec!["--stdio"], vec!["vue"]),
    // Bash - bash-language-server
    LspServerConfig::new("bash", "bash-language-server", vec!["start"], vec!["sh", "bash"]),
  ]
}

/// Manages multiple LSP servers
pub struct LspManager {
  clients: DashMap<String, Arc<LspClient>>,
  configs: DashMap<String, LspServerConfig>,
  extension_map: DashMap<String, String>,
}

impl LspManager {
  /// Create a new LSP manager with default configurations
  pub fn new() -> Self {
    let manager = Self {
      clients: DashMap::new(),
      configs: DashMap::new(),
      extension_map: DashMap::new(),
    };

    // Load default configs
    for config in default_lsp_configs() {
      for ext in &config.extensions {
        manager.extension_map.insert(ext.clone(), config.language_id.clone());
      }
      manager.configs.insert(config.language_id.clone(), config);
    }

    manager
  }

  /// Get the language ID for a file extension
  pub fn language_for_extension(&self, extension: &str) -> Option<String> {
    self.extension_map.get(extension).map(|v| v.clone())
  }

  /// Get the config for a language
  pub fn config_for(&self, language: &str) -> Option<LspServerConfig> {
    self.configs.get(language).map(|v| v.clone())
  }

  /// Get an existing client for a language (if running)
  pub fn get_client(&self, language: &str) -> Option<Arc<LspClient>> {
    self.clients.get(language).map(|v| v.clone())
  }

  /// Start an LSP server for a language
  pub async fn start(&self, language: &str, root_path: PathBuf) -> Result<Arc<LspClient>> {
    // Check if already running
    if let Some(client) = self.clients.get(language) {
      if client.state() == LspClientState::Running {
        return Ok(client.clone());
      }
    }

    // Get config
    let config = self
      .configs
      .get(language)
      .ok_or_else(|| Error::LspNotRunning {
        language: format!("No LSP config for language: {}", language),
      })?;

    info!("Starting LSP server for {}: {}", language, config.command);

    // Create and start client
    let client = Arc::new(LspClient::new(language));
    let args: Vec<&str> = config.args.iter().map(String::as_str).collect();

    client.start(&config.command, &args, root_path).await?;

    // Store client
    self.clients.insert(language.to_string(), client.clone());

    Ok(client)
  }

  /// Stop an LSP server
  pub async fn stop(&self, language: &str) -> Result<()> {
    if let Some((_, client)) = self.clients.remove(language) {
      client.stop().await?;
    }
    Ok(())
  }

  /// Stop all language servers
  pub async fn stop_all(&self) {
    let languages: Vec<String> = self.clients.iter().map(|e| e.key().clone()).collect();
    for language in languages {
      if let Err(e) = self.stop(&language).await {
        warn!("Failed to stop LSP for {}: {}", language, e);
      }
    }
  }

  /// Check if a language server is running
  pub fn is_running(&self, language: &str) -> bool {
    self
      .clients
      .get(language)
      .map(|c| c.state() == LspClientState::Running)
      .unwrap_or(false)
  }

  /// Get status of all running servers
  pub fn status(&self) -> Vec<(String, LspClientState)> {
    self
      .clients
      .iter()
      .map(|e| (e.key().clone(), e.value().state()))
      .collect()
  }

  /// Register a custom LSP config
  pub fn register_config(&self, config: LspServerConfig) {
    for ext in &config.extensions {
      self.extension_map.insert(ext.clone(), config.language_id.clone());
    }
    self.configs.insert(config.language_id.clone(), config);
  }
}

impl Default for LspManager {
  fn default() -> Self {
    Self::new()
  }
}
