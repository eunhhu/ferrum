//! Application state management

use ferrum_editor::Editor;
use ferrum_lsp::LspManager;
use ferrum_search::FileSearcher;
use ferrum_settings::Settings;
use parking_lot::RwLock;
use std::sync::Arc;

/// Global application state
pub struct AppState {
    pub editor: Arc<Editor>,
    pub lsp: Arc<LspManager>,
    pub file_searcher: Arc<RwLock<FileSearcher>>,
    pub settings: Arc<RwLock<Settings>>,
}

impl AppState {
    /// Create new application state
    pub fn new() -> Self {
        Self {
            editor: Arc::new(Editor::new()),
            lsp: Arc::new(LspManager::new()),
            file_searcher: Arc::new(RwLock::new(FileSearcher::new())),
            settings: Arc::new(RwLock::new(Settings::default())),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}
