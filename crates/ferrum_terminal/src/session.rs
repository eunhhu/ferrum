//! Terminal session management

use ferrum_core::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Terminal session configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalConfig {
  pub shell: Option<String>,
  pub cwd: Option<PathBuf>,
  pub env: Vec<(String, String)>,
  pub rows: u16,
  pub cols: u16,
}

impl Default for TerminalConfig {
  fn default() -> Self {
    Self {
      shell: None,
      cwd: None,
      env: Vec::new(),
      rows: 24,
      cols: 80,
    }
  }
}

/// A terminal session
pub struct TerminalSession {
  id: ferrum_core::id::SessionId,
  config: TerminalConfig,
}

impl TerminalSession {
  /// Create a new terminal session
  pub fn new(config: TerminalConfig) -> Self {
    Self {
      id: ferrum_core::id::SessionId::new(),
      config,
    }
  }

  /// Get the session ID
  pub fn id(&self) -> ferrum_core::id::SessionId {
    self.id
  }

  /// Get the configuration
  pub fn config(&self) -> &TerminalConfig {
    &self.config
  }
}
