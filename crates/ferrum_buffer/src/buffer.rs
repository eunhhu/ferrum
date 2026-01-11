//! Core buffer implementation

use ferrum_core::id::{BufferId, TransactionId};
use ferrum_core::prelude::*;
use parking_lot::RwLock;
use ropey::Rope;
use std::path::PathBuf;
use std::sync::Arc;

use crate::edit::{Edit, EditKind};
use crate::history::History;
use crate::position::Point;

/// A text buffer backed by a rope data structure
pub struct Buffer {
  id: BufferId,
  content: RwLock<Rope>,
  history: RwLock<History>,
  file_path: RwLock<Option<PathBuf>>,
  is_dirty: RwLock<bool>,
  language_id: RwLock<Option<String>>,
  version: RwLock<u64>,
}

impl Buffer {
  /// Create a new empty buffer
  pub fn new() -> Self {
    Self {
      id: BufferId::new(),
      content: RwLock::new(Rope::new()),
      history: RwLock::new(History::new()),
      file_path: RwLock::new(None),
      is_dirty: RwLock::new(false),
      language_id: RwLock::new(None),
      version: RwLock::new(0),
    }
  }

  /// Create a buffer with initial content
  pub fn with_content(content: &str) -> Self {
    Self {
      id: BufferId::new(),
      content: RwLock::new(Rope::from_str(content)),
      history: RwLock::new(History::new()),
      file_path: RwLock::new(None),
      is_dirty: RwLock::new(false),
      language_id: RwLock::new(None),
      version: RwLock::new(0),
    }
  }

  /// Create a buffer from a file
  pub fn from_file(path: impl Into<PathBuf>, content: &str) -> Self {
    let path = path.into();
    let language_id = Self::detect_language(&path);

    Self {
      id: BufferId::new(),
      content: RwLock::new(Rope::from_str(content)),
      history: RwLock::new(History::new()),
      file_path: RwLock::new(Some(path)),
      is_dirty: RwLock::new(false),
      language_id: RwLock::new(language_id),
      version: RwLock::new(0),
    }
  }

  /// Get the buffer ID
  pub fn id(&self) -> BufferId {
    self.id
  }

  /// Get the file path if associated with a file
  pub fn file_path(&self) -> Option<PathBuf> {
    self.file_path.read().clone()
  }

  /// Set the file path
  pub fn set_file_path(&self, path: impl Into<PathBuf>) {
    let path = path.into();
    let language = Self::detect_language(&path);
    *self.file_path.write() = Some(path);
    *self.language_id.write() = language;
  }

  /// Check if buffer has unsaved changes
  pub fn is_dirty(&self) -> bool {
    *self.is_dirty.read()
  }

  /// Mark buffer as saved
  pub fn mark_saved(&self) {
    *self.is_dirty.write() = false;
  }

  /// Get the language ID
  pub fn language_id(&self) -> Option<String> {
    self.language_id.read().clone()
  }

  /// Get the current version
  pub fn version(&self) -> u64 {
    *self.version.read()
  }

  /// Get the total number of characters
  pub fn len_chars(&self) -> usize {
    self.content.read().len_chars()
  }

  /// Get the total number of lines
  pub fn len_lines(&self) -> usize {
    self.content.read().len_lines()
  }

  /// Check if buffer is empty
  pub fn is_empty(&self) -> bool {
    self.content.read().len_chars() == 0
  }

  /// Get the entire content as a string
  pub fn to_string(&self) -> String {
    self.content.read().to_string()
  }

  /// Get a specific line
  pub fn line(&self, line_idx: usize) -> Option<String> {
    let content = self.content.read();
    if line_idx >= content.len_lines() {
      return None;
    }
    Some(content.line(line_idx).to_string())
  }

  /// Get a slice of the buffer content
  pub fn slice(&self, start: usize, end: usize) -> Result<String> {
    let content = self.content.read();
    if end > content.len_chars() {
      return Err(Error::InvalidRange { start, end });
    }
    Ok(content.slice(start..end).to_string())
  }

  /// Insert text at a position
  pub fn insert(&self, char_idx: usize, text: &str) -> Result<()> {
    let mut content = self.content.write();
    if char_idx > content.len_chars() {
      return Err(Error::InvalidPosition {
        line: 0,
        column: char_idx,
      });
    }

    // Record edit for undo
    let edit = Edit::new(
      EditKind::Insert,
      char_idx,
      text.len(),
      String::new(),
      text.to_string(),
    );

    self.history.write().push(edit);
    content.insert(char_idx, text);

    *self.is_dirty.write() = true;
    *self.version.write() += 1;

    Ok(())
  }

  /// Delete text in a range
  pub fn delete(&self, start: usize, end: usize) -> Result<String> {
    let mut content = self.content.write();
    if end > content.len_chars() || start > end {
      return Err(Error::InvalidRange { start, end });
    }

    let deleted = content.slice(start..end).to_string();

    // Record edit for undo
    let edit = Edit::new(
      EditKind::Delete,
      start,
      end - start,
      deleted.clone(),
      String::new(),
    );

    self.history.write().push(edit);
    content.remove(start..end);

    *self.is_dirty.write() = true;
    *self.version.write() += 1;

    Ok(deleted)
  }

  /// Replace text in a range
  pub fn replace(&self, start: usize, end: usize, text: &str) -> Result<String> {
    let mut content = self.content.write();
    if end > content.len_chars() || start > end {
      return Err(Error::InvalidRange { start, end });
    }

    let old_text = content.slice(start..end).to_string();

    // Record edit for undo
    let edit = Edit::new(
      EditKind::Replace,
      start,
      end - start,
      old_text.clone(),
      text.to_string(),
    );

    self.history.write().push(edit);
    content.remove(start..end);
    content.insert(start, text);

    *self.is_dirty.write() = true;
    *self.version.write() += 1;

    Ok(old_text)
  }

  /// Undo the last edit
  pub fn undo(&self) -> Option<Edit> {
    let edit = self.history.write().undo()?;
    let mut content = self.content.write();

    match edit.kind() {
      EditKind::Insert => {
        content.remove(edit.position()..edit.position() + edit.len());
      },
      EditKind::Delete => {
        content.insert(edit.position(), edit.old_text());
      },
      EditKind::Replace => {
        content.remove(edit.position()..edit.position() + edit.new_text().len());
        content.insert(edit.position(), edit.old_text());
      },
    }

    *self.version.write() += 1;
    Some(edit)
  }

  /// Redo the last undone edit
  pub fn redo(&self) -> Option<Edit> {
    let edit = self.history.write().redo()?;
    let mut content = self.content.write();

    match edit.kind() {
      EditKind::Insert => {
        content.insert(edit.position(), edit.new_text());
      },
      EditKind::Delete => {
        content.remove(edit.position()..edit.position() + edit.len());
      },
      EditKind::Replace => {
        content.remove(edit.position()..edit.position() + edit.old_text().len());
        content.insert(edit.position(), edit.new_text());
      },
    }

    *self.version.write() += 1;
    Some(edit)
  }

  /// Convert a character index to a line/column position
  pub fn char_to_point(&self, char_idx: usize) -> Option<Point> {
    let content = self.content.read();
    if char_idx > content.len_chars() {
      return None;
    }

    let line = content.char_to_line(char_idx);
    let line_start = content.line_to_char(line);
    let column = char_idx - line_start;

    Some(Point::new(line, column))
  }

  /// Convert a line/column position to a character index
  pub fn point_to_char(&self, point: Point) -> Option<usize> {
    let content = self.content.read();
    if point.line >= content.len_lines() {
      return None;
    }

    let line_start = content.line_to_char(point.line);
    let line_len = content.line(point.line).len_chars();

    if point.column > line_len {
      return None;
    }

    Some(line_start + point.column)
  }

  /// Detect language from file extension
  fn detect_language(path: &PathBuf) -> Option<String> {
    path
      .extension()
      .and_then(|ext| ext.to_str())
      .map(|ext| match ext {
        "rs" => "rust",
        "ts" | "tsx" => "typescript",
        "js" | "jsx" => "javascript",
        "py" => "python",
        "go" => "go",
        "c" | "h" => "c",
        "cpp" | "hpp" | "cc" | "hh" => "cpp",
        "java" => "java",
        "rb" => "ruby",
        "swift" => "swift",
        "kt" | "kts" => "kotlin",
        "json" => "json",
        "yaml" | "yml" => "yaml",
        "toml" => "toml",
        "md" => "markdown",
        "html" | "htm" => "html",
        "css" => "css",
        "scss" | "sass" => "scss",
        "sql" => "sql",
        "sh" | "bash" | "zsh" => "bash",
        _ => ext,
      })
      .map(String::from)
  }
}

impl Default for Buffer {
  fn default() -> Self {
    Self::new()
  }
}

impl ferrum_core::id::HasId for Buffer {
  type Id = BufferId;

  fn id(&self) -> BufferId {
    self.id
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_buffer_creation() {
    let buffer = Buffer::new();
    assert!(buffer.is_empty());
    assert!(!buffer.is_dirty());
  }

  #[test]
  fn test_buffer_with_content() {
    let buffer = Buffer::with_content("Hello, World!");
    assert_eq!(buffer.len_chars(), 13);
    assert_eq!(buffer.len_lines(), 1);
  }

  #[test]
  fn test_insert() {
    let buffer = Buffer::new();
    buffer.insert(0, "Hello").unwrap();
    assert_eq!(buffer.to_string(), "Hello");
    assert!(buffer.is_dirty());

    buffer.insert(5, ", World!").unwrap();
    assert_eq!(buffer.to_string(), "Hello, World!");
  }

  #[test]
  fn test_delete() {
    let buffer = Buffer::with_content("Hello, World!");
    let deleted = buffer.delete(5, 7).unwrap();
    assert_eq!(deleted, ", ");
    assert_eq!(buffer.to_string(), "HelloWorld!");
  }

  #[test]
  fn test_replace() {
    let buffer = Buffer::with_content("Hello, World!");
    let old = buffer.replace(7, 12, "Rust").unwrap();
    assert_eq!(old, "World");
    assert_eq!(buffer.to_string(), "Hello, Rust!");
  }

  #[test]
  fn test_undo_redo() {
    let buffer = Buffer::new();
    buffer.insert(0, "Hello").unwrap();
    buffer.insert(5, " World").unwrap();
    assert_eq!(buffer.to_string(), "Hello World");

    buffer.undo();
    assert_eq!(buffer.to_string(), "Hello");

    buffer.undo();
    assert_eq!(buffer.to_string(), "");

    buffer.redo();
    assert_eq!(buffer.to_string(), "Hello");

    buffer.redo();
    assert_eq!(buffer.to_string(), "Hello World");
  }

  #[test]
  fn test_char_to_point() {
    let buffer = Buffer::with_content("Hello\nWorld\n!");

    assert_eq!(buffer.char_to_point(0), Some(Point::new(0, 0)));
    assert_eq!(buffer.char_to_point(5), Some(Point::new(0, 5)));
    assert_eq!(buffer.char_to_point(6), Some(Point::new(1, 0)));
    assert_eq!(buffer.char_to_point(12), Some(Point::new(2, 0)));
  }

  #[test]
  fn test_language_detection() {
    let buffer = Buffer::from_file("/test/file.rs", "");
    assert_eq!(buffer.language_id(), Some("rust".to_string()));

    let buffer = Buffer::from_file("/test/file.tsx", "");
    assert_eq!(buffer.language_id(), Some("typescript".to_string()));
  }
}
