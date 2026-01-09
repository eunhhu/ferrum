//! Undo/redo history management

use crate::edit::Edit;
use ferrum_core::constants::MAX_UNDO_HISTORY;

/// Manages undo/redo history for a buffer
pub struct History {
    /// Stack of undoable edits
    undo_stack: Vec<Edit>,
    /// Stack of redoable edits
    redo_stack: Vec<Edit>,
    /// Maximum number of entries to keep
    max_entries: usize,
    /// Whether to merge consecutive edits
    merge_enabled: bool,
}

impl History {
    /// Create a new history
    pub fn new() -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
            max_entries: MAX_UNDO_HISTORY,
            merge_enabled: true,
        }
    }

    /// Create history with custom max entries
    pub fn with_max_entries(max_entries: usize) -> Self {
        Self {
            max_entries,
            ..Self::new()
        }
    }

    /// Push an edit onto the history
    pub fn push(&mut self, edit: Edit) {
        // Clear redo stack when new edit is made
        self.redo_stack.clear();

        // Try to merge with the last edit
        if self.merge_enabled {
            if let Some(last) = self.undo_stack.last_mut() {
                if last.can_merge_with(&edit) {
                    last.merge(edit);
                    return;
                }
            }
        }

        self.undo_stack.push(edit);

        // Enforce max entries
        if self.undo_stack.len() > self.max_entries {
            self.undo_stack.remove(0);
        }
    }

    /// Undo the last edit, returning it
    pub fn undo(&mut self) -> Option<Edit> {
        let edit = self.undo_stack.pop()?;
        self.redo_stack.push(edit.clone());
        Some(edit)
    }

    /// Redo the last undone edit, returning it
    pub fn redo(&mut self) -> Option<Edit> {
        let edit = self.redo_stack.pop()?;
        self.undo_stack.push(edit.clone());
        Some(edit)
    }

    /// Check if undo is available
    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    /// Check if redo is available
    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    /// Get the number of undoable operations
    pub fn undo_count(&self) -> usize {
        self.undo_stack.len()
    }

    /// Get the number of redoable operations
    pub fn redo_count(&self) -> usize {
        self.redo_stack.len()
    }

    /// Clear all history
    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }

    /// Enable or disable edit merging
    pub fn set_merge_enabled(&mut self, enabled: bool) {
        self.merge_enabled = enabled;
    }

    /// Start a transaction group (prevents merging with previous edits)
    pub fn begin_transaction(&mut self) {
        self.merge_enabled = false;
    }

    /// End a transaction group
    pub fn end_transaction(&mut self) {
        self.merge_enabled = true;
    }
}

impl Default for History {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::edit::EditKind;

    #[test]
    fn test_history_undo_redo() {
        let mut history = History::new();

        let edit1 = Edit::new(EditKind::Insert, 0, 5, String::new(), "Hello".to_string());
        let edit2 = Edit::new(EditKind::Insert, 5, 6, String::new(), " World".to_string());

        history.push(edit1);
        history.push(edit2);

        assert_eq!(history.undo_count(), 2);
        assert!(history.can_undo());
        assert!(!history.can_redo());

        history.undo();
        assert_eq!(history.undo_count(), 1);
        assert_eq!(history.redo_count(), 1);

        history.redo();
        assert_eq!(history.undo_count(), 2);
        assert_eq!(history.redo_count(), 0);
    }

    #[test]
    fn test_history_max_entries() {
        let mut history = History::with_max_entries(2);
        history.set_merge_enabled(false);

        history.push(Edit::new(EditKind::Insert, 0, 1, String::new(), "a".to_string()));
        history.push(Edit::new(EditKind::Insert, 1, 1, String::new(), "b".to_string()));
        history.push(Edit::new(EditKind::Insert, 2, 1, String::new(), "c".to_string()));

        assert_eq!(history.undo_count(), 2);
    }

    #[test]
    fn test_new_edit_clears_redo() {
        let mut history = History::new();
        history.set_merge_enabled(false);

        history.push(Edit::new(EditKind::Insert, 0, 1, String::new(), "a".to_string()));
        history.push(Edit::new(EditKind::Insert, 1, 1, String::new(), "b".to_string()));

        history.undo();
        assert_eq!(history.redo_count(), 1);

        history.push(Edit::new(EditKind::Insert, 1, 1, String::new(), "c".to_string()));
        assert_eq!(history.redo_count(), 0);
    }
}
