//! Core editor implementation

use dashmap::DashMap;
use ferrum_buffer::Buffer;
use ferrum_core::prelude::*;
use parking_lot::RwLock;
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
}

impl Editor {
    /// Create a new editor
    pub fn new() -> Self {
        Self {
            buffers: DashMap::new(),
            active_buffer: RwLock::new(None),
            path_to_buffer: DashMap::new(),
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
