//! Edit operations and change tracking

use serde::{Deserialize, Serialize};

/// Kind of edit operation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum EditKind {
    Insert,
    Delete,
    Replace,
}

/// A single edit operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edit {
    kind: EditKind,
    position: usize,
    len: usize,
    old_text: String,
    new_text: String,
}

impl Edit {
    /// Create a new edit
    pub fn new(
        kind: EditKind,
        position: usize,
        len: usize,
        old_text: String,
        new_text: String,
    ) -> Self {
        Self {
            kind,
            position,
            len,
            old_text,
            new_text,
        }
    }

    /// Get the kind of edit
    pub fn kind(&self) -> EditKind {
        self.kind
    }

    /// Get the position where the edit occurred
    pub fn position(&self) -> usize {
        self.position
    }

    /// Get the length of affected text
    pub fn len(&self) -> usize {
        self.len
    }

    /// Check if this is an empty edit
    pub fn is_empty(&self) -> bool {
        self.len == 0 && self.old_text.is_empty() && self.new_text.is_empty()
    }

    /// Get the old text (before edit)
    pub fn old_text(&self) -> &str {
        &self.old_text
    }

    /// Get the new text (after edit)
    pub fn new_text(&self) -> &str {
        &self.new_text
    }

    /// Create the inverse of this edit (for undo)
    pub fn inverse(&self) -> Self {
        match self.kind {
            EditKind::Insert => Self {
                kind: EditKind::Delete,
                position: self.position,
                len: self.new_text.len(),
                old_text: self.new_text.clone(),
                new_text: String::new(),
            },
            EditKind::Delete => Self {
                kind: EditKind::Insert,
                position: self.position,
                len: 0,
                old_text: String::new(),
                new_text: self.old_text.clone(),
            },
            EditKind::Replace => Self {
                kind: EditKind::Replace,
                position: self.position,
                len: self.new_text.len(),
                old_text: self.new_text.clone(),
                new_text: self.old_text.clone(),
            },
        }
    }

    /// Check if this edit can be merged with another
    pub fn can_merge_with(&self, other: &Edit) -> bool {
        // Only merge consecutive inserts or deletes of single characters
        if self.kind != other.kind {
            return false;
        }

        match self.kind {
            EditKind::Insert => {
                // Merge consecutive inserts
                other.position == self.position + self.new_text.len()
                    && self.new_text.len() < 50
                    && !self.new_text.ends_with('\n')
            }
            EditKind::Delete => {
                // Merge consecutive deletes (backspace)
                other.position + other.len == self.position
                    && self.old_text.len() < 50
                    && !other.old_text.ends_with('\n')
            }
            EditKind::Replace => false,
        }
    }

    /// Merge another edit into this one
    pub fn merge(&mut self, other: Edit) {
        match self.kind {
            EditKind::Insert => {
                self.new_text.push_str(&other.new_text);
                self.len = self.new_text.len();
            }
            EditKind::Delete => {
                self.position = other.position;
                self.old_text = other.old_text + &self.old_text;
                self.len = self.old_text.len();
            }
            EditKind::Replace => {
                // Should not happen due to can_merge_with
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_edit_inverse() {
        let insert = Edit::new(EditKind::Insert, 0, 5, String::new(), "Hello".to_string());
        let inverse = insert.inverse();

        assert_eq!(inverse.kind(), EditKind::Delete);
        assert_eq!(inverse.position(), 0);
        assert_eq!(inverse.old_text(), "Hello");
    }

    #[test]
    fn test_edit_merge() {
        let mut edit1 = Edit::new(EditKind::Insert, 0, 1, String::new(), "H".to_string());
        let edit2 = Edit::new(EditKind::Insert, 1, 1, String::new(), "i".to_string());

        assert!(edit1.can_merge_with(&edit2));
        edit1.merge(edit2);

        assert_eq!(edit1.new_text(), "Hi");
    }
}
