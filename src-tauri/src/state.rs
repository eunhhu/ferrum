//! Application state management

use ferrum_editor::Editor;
use ferrum_fs::FileWatcher;
use ferrum_lsp::LspManager;
use ferrum_search::FileSearcher;
use ferrum_settings::Settings;
use parking_lot::RwLock;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::Mutex;

/// File watcher state
pub struct WatcherState {
  pub watcher: Option<FileWatcher>,
  pub watched_paths: HashSet<String>,
}

impl WatcherState {
  pub fn new() -> Self {
    Self {
      watcher: None,
      watched_paths: HashSet::new(),
    }
  }
}

/// Global application state
pub struct AppState {
  pub editor: Arc<Editor>,
  pub lsp: Arc<LspManager>,
  pub file_searcher: Arc<RwLock<FileSearcher>>,
  pub settings: Arc<RwLock<Settings>>,
  pub watcher: Arc<Mutex<WatcherState>>,
}

impl AppState {
  /// Create new application state
  pub fn new() -> Self {
    Self {
      editor: Arc::new(Editor::new()),
      lsp: Arc::new(LspManager::new()),
      file_searcher: Arc::new(RwLock::new(FileSearcher::new())),
      settings: Arc::new(RwLock::new(Settings::default())),
      watcher: Arc::new(Mutex::new(WatcherState::new())),
    }
  }
}

impl Default for AppState {
  fn default() -> Self {
    Self::new()
  }
}
