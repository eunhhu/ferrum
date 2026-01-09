//! LSP client implementation (placeholder)

use ferrum_core::prelude::*;

/// LSP client for a single language server
pub struct LspClient {
    language: String,
    initialized: bool,
}

impl LspClient {
    /// Create a new LSP client
    pub fn new(language: impl Into<String>) -> Self {
        Self {
            language: language.into(),
            initialized: false,
        }
    }

    /// Get the language
    pub fn language(&self) -> &str {
        &self.language
    }

    /// Check if initialized
    pub fn is_initialized(&self) -> bool {
        self.initialized
    }
}
