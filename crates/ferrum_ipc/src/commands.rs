//! Tauri command definitions
//!
//! This module will contain all Tauri commands exposed to the frontend.
//! Commands are organized by domain.

use serde::{Deserialize, Serialize};

// Re-export for use in command definitions
pub use ferrum_core::id::*;

/// File content response
#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
  pub path: String,
  pub content: String,
  pub language: Option<String>,
}

/// Directory listing response
#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryListing {
  pub path: String,
  pub entries: Vec<DirectoryEntry>,
}

/// A directory entry
#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryEntry {
  pub name: String,
  pub path: String,
  pub is_dir: bool,
  pub is_hidden: bool,
  pub size: u64,
}

/// Buffer state response
#[derive(Debug, Serialize, Deserialize)]
pub struct BufferState {
  pub id: BufferId,
  pub content: String,
  pub version: u64,
  pub is_dirty: bool,
  pub language: Option<String>,
}

/// Search result
#[derive(Debug, Serialize, Deserialize)]
pub struct SearchResult {
  pub path: String,
  pub line: usize,
  pub column: usize,
  pub content: String,
  pub match_start: usize,
  pub match_end: usize,
}

/// File search result
#[derive(Debug, Serialize, Deserialize)]
pub struct FileSearchResult {
  pub path: String,
  pub score: f64,
}

/// Git status response
#[derive(Debug, Serialize, Deserialize)]
pub struct GitStatusResponse {
  pub branch: Option<String>,
  pub is_clean: bool,
  pub staged: Vec<GitFileStatus>,
  pub unstaged: Vec<GitFileStatus>,
  pub untracked: Vec<String>,
}

/// Git file status
#[derive(Debug, Serialize, Deserialize)]
pub struct GitFileStatus {
  pub path: String,
  pub status: String,
}

/// LSP hover response
#[derive(Debug, Serialize, Deserialize)]
pub struct HoverResponse {
  pub contents: String,
  pub range: Option<(usize, usize)>,
}

/// LSP completion item
#[derive(Debug, Serialize, Deserialize)]
pub struct CompletionItem {
  pub label: String,
  pub kind: String,
  pub detail: Option<String>,
  pub insert_text: Option<String>,
}

/// Settings response
#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsResponse {
  pub settings: serde_json::Value,
}
