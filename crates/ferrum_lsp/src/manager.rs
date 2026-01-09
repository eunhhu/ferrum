//! LSP server manager (placeholder)

use dashmap::DashMap;
use ferrum_core::prelude::*;
use std::sync::Arc;

use crate::client::LspClient;

/// Manages multiple LSP servers
pub struct LspManager {
    clients: DashMap<String, Arc<LspClient>>,
}

impl LspManager {
    /// Create a new LSP manager
    pub fn new() -> Self {
        Self {
            clients: DashMap::new(),
        }
    }

    /// Get or create a client for a language
    pub fn client_for(&self, language: &str) -> Arc<LspClient> {
        self.clients
            .entry(language.to_string())
            .or_insert_with(|| Arc::new(LspClient::new(language)))
            .clone()
    }

    /// Stop a language server
    pub fn stop(&self, language: &str) {
        self.clients.remove(language);
    }

    /// Stop all language servers
    pub fn stop_all(&self) {
        self.clients.clear();
    }
}

impl Default for LspManager {
    fn default() -> Self {
        Self::new()
    }
}
