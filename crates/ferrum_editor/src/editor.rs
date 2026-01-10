//! Core editor implementation

use dashmap::DashMap;
use ferrum_buffer::syntax::{LanguageId, ParseResult, SyntaxManager};
use ferrum_buffer::Buffer;
use ferrum_core::prelude::*;
use parking_lot::RwLock;
use ropey::Rope;
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
        self.path_to_buffer
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
        self.buffers
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
        }

        let manager = self.syntax_managers.get(&buffer_id).unwrap();
        let rope = Rope::from_str(&buffer.to_string());

        // Get range
        let start = start_byte.unwrap_or(0);
        let end = end_byte.unwrap_or(rope.len_bytes());

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
            }
        }
        Ok(())
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
