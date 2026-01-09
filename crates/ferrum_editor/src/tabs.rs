//! Tab management

use ferrum_core::prelude::*;
use indexmap::IndexMap;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// A single editor tab
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tab {
    pub id: TabId,
    pub buffer_id: BufferId,
    pub title: String,
    pub path: Option<PathBuf>,
    pub is_preview: bool,
    pub is_pinned: bool,
}

impl Tab {
    /// Create a new tab
    pub fn new(buffer_id: BufferId, title: impl Into<String>) -> Self {
        Self {
            id: TabId::new(),
            buffer_id,
            title: title.into(),
            path: None,
            is_preview: false,
            is_pinned: false,
        }
    }

    /// Create a tab for a file
    pub fn for_file(buffer_id: BufferId, path: impl Into<PathBuf>) -> Self {
        let path = path.into();
        let title = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Untitled".to_string());

        Self {
            id: TabId::new(),
            buffer_id,
            title,
            path: Some(path),
            is_preview: true,
            is_pinned: false,
        }
    }

    /// Mark as not preview (user made an edit)
    pub fn make_permanent(&mut self) {
        self.is_preview = false;
    }

    /// Pin the tab
    pub fn pin(&mut self) {
        self.is_pinned = true;
        self.is_preview = false;
    }

    /// Unpin the tab
    pub fn unpin(&mut self) {
        self.is_pinned = false;
    }
}

/// A group of tabs
pub struct TabGroup {
    tabs: RwLock<IndexMap<TabId, Tab>>,
    active_tab: RwLock<Option<TabId>>,
}

impl TabGroup {
    /// Create a new tab group
    pub fn new() -> Self {
        Self {
            tabs: RwLock::new(IndexMap::new()),
            active_tab: RwLock::new(None),
        }
    }

    /// Add a tab
    pub fn add(&self, tab: Tab) -> TabId {
        let id = tab.id;
        let mut tabs = self.tabs.write();

        // If this is not a preview tab, or there's no preview tab, just add it
        if !tab.is_preview {
            tabs.insert(id, tab);
        } else {
            // Replace existing preview tab if any
            let preview_id = tabs.iter().find(|(_, t)| t.is_preview).map(|(id, _)| *id);
            if let Some(preview_id) = preview_id {
                tabs.shift_remove(&preview_id);
            }
            tabs.insert(id, tab);
        }

        // Set as active
        *self.active_tab.write() = Some(id);

        id
    }

    /// Remove a tab
    pub fn remove(&self, id: TabId) -> Option<Tab> {
        let mut tabs = self.tabs.write();
        let tab = tabs.shift_remove(&id)?;

        // Update active tab if needed
        let mut active = self.active_tab.write();
        if *active == Some(id) {
            // Select the next tab, or previous if none
            *active = tabs.keys().last().copied();
        }

        Some(tab)
    }

    /// Get a tab
    pub fn get(&self, id: TabId) -> Option<Tab> {
        self.tabs.read().get(&id).cloned()
    }

    /// Get the active tab
    pub fn active(&self) -> Option<Tab> {
        let active_id = *self.active_tab.read();
        active_id.and_then(|id| self.get(id))
    }

    /// Set the active tab
    pub fn set_active(&self, id: TabId) -> Result<()> {
        if !self.tabs.read().contains_key(&id) {
            return Err(Error::TabNotFound(id));
        }
        *self.active_tab.write() = Some(id);
        Ok(())
    }

    /// Get all tabs in order
    pub fn tabs(&self) -> Vec<Tab> {
        self.tabs.read().values().cloned().collect()
    }

    /// Get tab count
    pub fn len(&self) -> usize {
        self.tabs.read().len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.tabs.read().is_empty()
    }

    /// Find tab by buffer ID
    pub fn find_by_buffer(&self, buffer_id: BufferId) -> Option<Tab> {
        self.tabs
            .read()
            .values()
            .find(|t| t.buffer_id == buffer_id)
            .cloned()
    }

    /// Reorder tabs
    pub fn move_tab(&self, from_index: usize, to_index: usize) {
        let mut tabs = self.tabs.write();
        if from_index < tabs.len() && to_index < tabs.len() {
            tabs.move_index(from_index, to_index);
        }
    }
}

impl Default for TabGroup {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tab_creation() {
        let tab = Tab::new(BufferId::new(), "test.rs");
        assert_eq!(tab.title, "test.rs");
        assert!(!tab.is_preview);
    }

    #[test]
    fn test_tab_group() {
        let group = TabGroup::new();

        let tab1 = Tab::new(BufferId::new(), "file1.rs");
        let tab2 = Tab::new(BufferId::new(), "file2.rs");

        let id1 = group.add(tab1);
        let id2 = group.add(tab2);

        assert_eq!(group.len(), 2);
        assert_eq!(group.active().unwrap().id, id2);

        group.set_active(id1).unwrap();
        assert_eq!(group.active().unwrap().id, id1);
    }

    #[test]
    fn test_preview_tab_replacement() {
        let group = TabGroup::new();

        let preview1 = Tab::for_file(BufferId::new(), "/test/file1.rs");
        let preview2 = Tab::for_file(BufferId::new(), "/test/file2.rs");

        group.add(preview1);
        group.add(preview2);

        // Preview tabs should replace each other
        assert_eq!(group.len(), 1);
    }
}
