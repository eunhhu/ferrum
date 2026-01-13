//! Core editor implementation

use crate::depth::DepthAnalyzer;
use crate::fold::FoldState;
use dashmap::DashMap;
use ferrum_buffer::Buffer;
use ferrum_buffer::position::Range;
use ferrum_buffer::syntax::{LanguageId, ParseResult, SyntaxManager};
use ferrum_core::prelude::*;
use parking_lot::RwLock;
use ropey::Rope;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;

/// The main editor state
pub struct Editor {
  /// All open buffers
  buffers: DashMap<BufferId, Arc<Buffer>>,
  /// Active buffer ID
  active_buffer: RwLock<Option<BufferId>>,
  /// File path to buffer ID mapping
  path_to_buffer: DashMap<PathBuf, BufferId>,
  /// Syntax managers for each buffer
  syntax_managers: DashMap<BufferId, SyntaxManager>,
  /// Depth analyzers for each buffer
  depth_analyzers: DashMap<BufferId, DepthAnalyzer>,
  /// Fold state for each buffer
  fold_states: DashMap<BufferId, parking_lot::RwLock<FoldState>>,
  /// Current project root
  project_root: RwLock<Option<PathBuf>>,
}

impl Editor {
  /// Create a new editor
  pub fn new() -> Self {
    Self {
      buffers: DashMap::new(),
      active_buffer: RwLock::new(None),
      path_to_buffer: DashMap::new(),
      syntax_managers: DashMap::new(),
      depth_analyzers: DashMap::new(),
      fold_states: DashMap::new(),
      project_root: RwLock::new(None),
    }
  }

  /// Create a new buffer
  pub fn create_buffer(&self) -> Arc<Buffer> {
    let buffer = Arc::new(Buffer::new());
    let id = buffer.id();
    self.buffers.insert(id, buffer.clone());
    buffer
  }

  /// Create a buffer with content
  pub fn create_buffer_with_content(&self, content: &str) -> Arc<Buffer> {
    let buffer = Arc::new(Buffer::with_content(content));
    let id = buffer.id();
    self.buffers.insert(id, buffer.clone());
    buffer
  }

  /// Open a file into a buffer
  pub fn open_file(&self, path: impl Into<PathBuf>, content: &str) -> Arc<Buffer> {
    let path = path.into();

    // Check if already open
    if let Some(buffer_id) = self.path_to_buffer.get(&path) {
      if let Some(buffer) = self.buffers.get(&buffer_id) {
        return buffer.clone();
      }
    }

    let buffer = Arc::new(Buffer::from_file(&path, content));
    let id = buffer.id();
    self.buffers.insert(id, buffer.clone());
    self.path_to_buffer.insert(path, id);

    buffer
  }

  /// Get a buffer by ID
  pub fn buffer(&self, id: BufferId) -> Option<Arc<Buffer>> {
    self.buffers.get(&id).map(|r| r.clone())
  }

  /// Get buffer by file path
  pub fn buffer_by_path(&self, path: &PathBuf) -> Option<Arc<Buffer>> {
    self
      .path_to_buffer
      .get(path)
      .and_then(|id| self.buffers.get(&id).map(|r| r.clone()))
  }

  /// Close a buffer
  pub fn close_buffer(&self, id: BufferId) -> Option<Arc<Buffer>> {
    let buffer = self.buffers.remove(&id).map(|(_, b)| b)?;

    // Remove from path mapping if it has a file
    if let Some(path) = buffer.file_path() {
      self.path_to_buffer.remove(&path);
    }

    // Clear active if this was it
    let mut active = self.active_buffer.write();
    if *active == Some(id) {
      *active = None;
    }

    Some(buffer)
  }

  /// Set the active buffer
  pub fn set_active(&self, id: BufferId) -> Result<()> {
    if !self.buffers.contains_key(&id) {
      return Err(Error::BufferNotFound(id));
    }
    *self.active_buffer.write() = Some(id);
    Ok(())
  }

  /// Get the active buffer
  pub fn active_buffer(&self) -> Option<Arc<Buffer>> {
    let active = self.active_buffer.read();
    active.and_then(|id| self.buffer(id))
  }

  /// Get the active buffer ID
  pub fn active_buffer_id(&self) -> Option<BufferId> {
    *self.active_buffer.read()
  }

  /// Get all buffer IDs
  pub fn buffer_ids(&self) -> Vec<BufferId> {
    self.buffers.iter().map(|r| *r.key()).collect()
  }

  /// Get count of open buffers
  pub fn buffer_count(&self) -> usize {
    self.buffers.len()
  }

  /// Check if a file is already open
  pub fn is_file_open(&self, path: &PathBuf) -> bool {
    self.path_to_buffer.contains_key(path)
  }

  /// Get all dirty buffers
  pub fn dirty_buffers(&self) -> Vec<Arc<Buffer>> {
    self
      .buffers
      .iter()
      .filter(|r| r.value().is_dirty())
      .map(|r| r.value().clone())
      .collect()
  }

  /// Set the project root
  pub fn set_project_root(&self, path: PathBuf) -> Result<()> {
    if !path.exists() || !path.is_dir() {
      return Err(Error::FileNotFound { path });
    }
    *self.project_root.write() = Some(path);
    Ok(())
  }

  /// Get the project root
  pub fn project_root(&self) -> Option<PathBuf> {
    self.project_root.read().clone()
  }

  /// Get syntax highlights for a buffer
  pub fn get_syntax_highlights(
    &self,
    buffer_id: BufferId,
    start_byte: Option<usize>,
    end_byte: Option<usize>,
  ) -> Result<ParseResult> {
    let buffer = self
      .buffers
      .get(&buffer_id)
      .ok_or(Error::BufferNotFound(buffer_id))?;

    // Get or create syntax manager
    let language_str = buffer.language_id().unwrap_or_default();
    let language = match language_str.as_str() {
      "rust" => LanguageId::Rust,
      "typescript" => LanguageId::TypeScript,
      "javascript" => LanguageId::JavaScript,
      "python" => LanguageId::Python,
      "go" => LanguageId::Go,
      "json" => LanguageId::Json,
      "toml" => LanguageId::Toml,
      "html" => LanguageId::Html,
      "css" => LanguageId::Css,
      "markdown" => LanguageId::Markdown,
      _ => return Ok(ParseResult::empty()),
    };

    // Get or create syntax manager for this buffer
    if !self.syntax_managers.contains_key(&buffer_id) {
      let manager = SyntaxManager::new(language)?;
      // Parse the buffer content
      let rope = Rope::from_str(&buffer.to_string());
      manager.parse(&rope)?;
      self.syntax_managers.insert(buffer_id, manager);

      // Initialize depth analyzer
      let mut depth_analyzer = DepthAnalyzer::new();
      if let Some(buffer) = self.buffers.get(&buffer_id) {
        self
          .syntax_managers
          .get(&buffer_id)
          .unwrap()
          .with_tree(|tree| {
            let text = buffer.to_string();
            depth_analyzer.analyze(tree, text.as_bytes());
          });
      }
      self.depth_analyzers.insert(buffer_id, depth_analyzer);

      // Initialize fold state
      let fold_state_lock = parking_lot::RwLock::new(FoldState::new());

      // Calculate folds from syntax tree
      if let Some(manager) = self.syntax_managers.get(&buffer_id) {
        manager.with_tree(|tree| {
          fold_state_lock.write().calculate_folds(tree);
        });
      }
      self.fold_states.insert(buffer_id, fold_state_lock);
    }

    let manager = self.syntax_managers.get(&buffer_id).unwrap();
    let rope = Rope::from_str(&buffer.to_string());

    // Get range for parsing
    let _start = start_byte.unwrap_or(0);
    let _end = end_byte.unwrap_or(rope.len_bytes());

    Ok(manager.parse_result(&rope))
  }

  /// Update syntax after buffer edit
  pub fn update_syntax_after_edit(
    &self,
    buffer_id: BufferId,
    start_byte: usize,
    old_end_byte: usize,
    new_end_byte: usize,
  ) -> Result<()> {
    if let Some(manager) = self.syntax_managers.get(&buffer_id) {
      if let Some(buffer) = self.buffers.get(&buffer_id) {
        let rope = Rope::from_str(&buffer.to_string());
        manager.edit(&rope, start_byte, old_end_byte, new_end_byte)?;

        // Update depth map
        if let Some(mut depth_analyzer) = self.depth_analyzers.get_mut(&buffer_id) {
          if let Some(buffer) = self.buffers.get(&buffer_id) {
            manager.with_tree(|tree| {
              let text = buffer.to_string();
              depth_analyzer.analyze(tree, text.as_bytes());
            });
          }
        }

        // Update fold ranges
        if let Some(fold_state) = self.fold_states.get(&buffer_id) {
          let mut fold_state = fold_state.write();
          manager.with_tree(|tree| {
            fold_state.calculate_folds(tree);
          });
        }
      }
    }
    Ok(())
  }
  /// Get depth map for a buffer
  pub fn get_depth_map(&self, buffer_id: BufferId) -> Option<HashMap<Range, u32>> {
    self
      .depth_analyzers
      .get(&buffer_id)
      .map(|a| a.depth_map.clone())
  }

  /// Get fold state for a buffer
  pub fn get_fold_state(&self, buffer_id: BufferId) -> Option<FoldState> {
    // Cloning FoldState might be expensive if map is huge, but fine for MVP
    self.fold_states.get(&buffer_id).map(|s| s.read().clone())
  }

  /// Toggle fold at a specific line
  pub fn toggle_fold(&self, buffer_id: BufferId, line: usize) -> Result<bool> {
    if let Some(fold_state) = self.fold_states.get(&buffer_id) {
      let mut fold_state = fold_state.write();
      let changed = fold_state.toggle_fold(line);
      Ok(changed)
    } else {
      Err(Error::BufferNotFound(buffer_id))
    }
  }

  /// Expand selection to the next larger syntax node
  /// Returns (start_line, start_col, end_line, end_col, start_byte, end_byte)
  pub fn expand_selection(
    &self,
    buffer_id: BufferId,
    start_byte: usize,
    end_byte: usize,
  ) -> Result<(usize, usize, usize, usize, usize, usize)> {
    let manager = self
      .syntax_managers
      .get(&buffer_id)
      .ok_or(Error::BufferNotFound(buffer_id))?;

    let result = manager.find_enclosing_node(start_byte, end_byte);

    match result {
      Some((start, end, start_point, end_point)) => {
        Ok((start_point.row, start_point.column, end_point.row, end_point.column, start, end))
      },
      None => {
        // No larger node found, return original selection
        let buffer = self.buffer(buffer_id).ok_or(Error::BufferNotFound(buffer_id))?;
        let rope = Rope::from_str(&buffer.to_string());
        let start_line = rope.byte_to_line(start_byte.min(rope.len_bytes()));
        let end_line = rope.byte_to_line(end_byte.min(rope.len_bytes()));
        let start_col = start_byte - rope.line_to_byte(start_line);
        let end_col = end_byte - rope.line_to_byte(end_line);
        Ok((start_line, start_col, end_line, end_col, start_byte, end_byte))
      },
    }
  }

  /// Shrink selection to the next smaller syntax node
  /// Returns (start_line, start_col, end_line, end_col, start_byte, end_byte)
  pub fn shrink_selection(
    &self,
    buffer_id: BufferId,
    start_byte: usize,
    end_byte: usize,
  ) -> Result<(usize, usize, usize, usize, usize, usize)> {
    let manager = self
      .syntax_managers
      .get(&buffer_id)
      .ok_or(Error::BufferNotFound(buffer_id))?;

    let result = manager.find_inner_node(start_byte, end_byte);

    match result {
      Some((start, end, start_point, end_point)) => {
        Ok((start_point.row, start_point.column, end_point.row, end_point.column, start, end))
      },
      None => {
        // No smaller node found, return original selection
        let buffer = self.buffer(buffer_id).ok_or(Error::BufferNotFound(buffer_id))?;
        let rope = Rope::from_str(&buffer.to_string());
        let start_line = rope.byte_to_line(start_byte.min(rope.len_bytes()));
        let end_line = rope.byte_to_line(end_byte.min(rope.len_bytes()));
        let start_col = start_byte - rope.line_to_byte(start_line);
        let end_col = end_byte - rope.line_to_byte(end_line);
        Ok((start_line, start_col, end_line, end_col, start_byte, end_byte))
      },
    }
  }
}

impl Default for Editor {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_create_buffer() {
    let editor = Editor::new();
    let buffer = editor.create_buffer();

    assert!(editor.buffer(buffer.id()).is_some());
    assert_eq!(editor.buffer_count(), 1);
  }

  #[test]
  fn test_open_file() {
    let editor = Editor::new();
    let buffer = editor.open_file("/test/file.rs", "fn main() {}");

    assert_eq!(buffer.language_id(), Some("rust".to_string()));
    assert!(!buffer.is_dirty());
  }

  #[test]
  fn test_close_buffer() {
    let editor = Editor::new();
    let buffer = editor.create_buffer();
    let id = buffer.id();

    editor.close_buffer(id);
    assert!(editor.buffer(id).is_none());
  }

  #[test]
  fn test_active_buffer() {
    let editor = Editor::new();
    let buffer = editor.create_buffer();

    editor.set_active(buffer.id()).unwrap();
    assert_eq!(editor.active_buffer_id(), Some(buffer.id()));
  }
}
