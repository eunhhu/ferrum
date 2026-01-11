//! Anchor system for stable position tracking
//!
//! Anchors represent positions in a buffer that automatically adjust when
//! the buffer is edited. This is essential for features like:
//! - Cursor positions
//! - Selection endpoints
//! - Bookmark locations
//! - Diagnostic ranges
//! - Fold regions

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};

/// Unique identifier for an anchor
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct AnchorId(u64);

impl AnchorId {
  /// Create a new unique anchor ID
  pub fn new() -> Self {
    static COUNTER: AtomicU64 = AtomicU64::new(1);
    Self(COUNTER.fetch_add(1, Ordering::SeqCst))
  }
}

impl Default for AnchorId {
  fn default() -> Self {
    Self::new()
  }
}

/// Bias determines how an anchor behaves when text is inserted at its position
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnchorBias {
  /// Anchor stays before inserted text (cursor-like behavior)
  Left,
  /// Anchor moves after inserted text (selection end behavior)
  Right,
}

impl Default for AnchorBias {
  fn default() -> Self {
    Self::Left
  }
}

/// An anchor in a buffer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Anchor {
  id: AnchorId,
  /// Current byte offset in the buffer
  offset: usize,
  /// Bias for insert behavior
  bias: AnchorBias,
  /// Whether this anchor is still valid
  valid: bool,
}

impl Anchor {
  /// Create a new anchor at the given offset
  pub fn new(offset: usize, bias: AnchorBias) -> Self {
    Self {
      id: AnchorId::new(),
      offset,
      bias,
      valid: true,
    }
  }

  /// Create a new anchor with left bias
  pub fn left(offset: usize) -> Self {
    Self::new(offset, AnchorBias::Left)
  }

  /// Create a new anchor with right bias
  pub fn right(offset: usize) -> Self {
    Self::new(offset, AnchorBias::Right)
  }

  /// Get the anchor ID
  pub fn id(&self) -> AnchorId {
    self.id
  }

  /// Get the current offset
  pub fn offset(&self) -> usize {
    self.offset
  }

  /// Get the bias
  pub fn bias(&self) -> AnchorBias {
    self.bias
  }

  /// Check if the anchor is still valid
  pub fn is_valid(&self) -> bool {
    self.valid
  }

  /// Invalidate the anchor (e.g., when the text it refers to is deleted)
  pub fn invalidate(&mut self) {
    self.valid = false;
  }

  /// Update the anchor position after an edit
  pub fn apply_edit(&mut self, edit_start: usize, old_len: usize, new_len: usize) {
    if !self.valid {
      return;
    }

    let edit_end = edit_start + old_len;

    if self.offset < edit_start {
      // Anchor is before the edit - no change needed
    } else if self.offset > edit_end {
      // Anchor is after the edit - adjust by the length difference
      if new_len >= old_len {
        self.offset += new_len - old_len;
      } else if self.offset >= old_len - new_len {
        self.offset -= old_len - new_len;
      } else {
        self.offset = edit_start;
      }
    } else if self.offset == edit_start {
      // Anchor is at the start of the edit
      match self.bias {
        AnchorBias::Left => {
          // Stay at the start
        },
        AnchorBias::Right => {
          // Move to end of new text
          self.offset = edit_start + new_len;
        },
      }
    } else {
      // Anchor is inside the deleted region
      // Move to start of edit
      self.offset = edit_start;
    }
  }
}

impl PartialEq for Anchor {
  fn eq(&self, other: &Self) -> bool {
    self.id == other.id
  }
}

impl Eq for Anchor {}

/// Manages a set of anchors for a buffer
pub struct AnchorSet {
  anchors: RwLock<HashMap<AnchorId, Anchor>>,
}

impl AnchorSet {
  /// Create a new empty anchor set
  pub fn new() -> Self {
    Self {
      anchors: RwLock::new(HashMap::new()),
    }
  }

  /// Create an anchor at the given offset
  pub fn create(&self, offset: usize, bias: AnchorBias) -> AnchorId {
    let anchor = Anchor::new(offset, bias);
    let id = anchor.id();
    self.anchors.write().insert(id, anchor);
    id
  }

  /// Create an anchor with left bias
  pub fn create_left(&self, offset: usize) -> AnchorId {
    self.create(offset, AnchorBias::Left)
  }

  /// Create an anchor with right bias
  pub fn create_right(&self, offset: usize) -> AnchorId {
    self.create(offset, AnchorBias::Right)
  }

  /// Get the offset of an anchor
  pub fn offset(&self, id: AnchorId) -> Option<usize> {
    self.anchors.read().get(&id).map(|a| a.offset())
  }

  /// Get anchor info
  pub fn get(&self, id: AnchorId) -> Option<Anchor> {
    self.anchors.read().get(&id).cloned()
  }

  /// Remove an anchor
  pub fn remove(&self, id: AnchorId) -> Option<Anchor> {
    self.anchors.write().remove(&id)
  }

  /// Update all anchors after an edit
  pub fn apply_edit(&self, edit_start: usize, old_len: usize, new_len: usize) {
    let mut anchors = self.anchors.write();
    for anchor in anchors.values_mut() {
      anchor.apply_edit(edit_start, old_len, new_len);
    }
  }

  /// Get the number of anchors
  pub fn len(&self) -> usize {
    self.anchors.read().len()
  }

  /// Check if empty
  pub fn is_empty(&self) -> bool {
    self.anchors.read().is_empty()
  }

  /// Clear all anchors
  pub fn clear(&self) {
    self.anchors.write().clear();
  }

  /// Get all anchor IDs
  pub fn ids(&self) -> Vec<AnchorId> {
    self.anchors.read().keys().copied().collect()
  }
}

impl Default for AnchorSet {
  fn default() -> Self {
    Self::new()
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_anchor_before_edit() {
    let mut anchor = Anchor::left(5);

    // Edit after the anchor
    anchor.apply_edit(10, 3, 5);
    assert_eq!(anchor.offset(), 5); // No change

    // Edit before the anchor
    anchor.apply_edit(0, 2, 4);
    assert_eq!(anchor.offset(), 7); // Shifted by 2
  }

  #[test]
  fn test_anchor_after_edit() {
    let mut anchor = Anchor::left(20);

    // Delete 5 chars at position 10
    anchor.apply_edit(10, 5, 0);
    assert_eq!(anchor.offset(), 15); // Moved back by 5
  }

  #[test]
  fn test_anchor_at_edit_with_bias() {
    // Left bias: stay at start
    let mut left = Anchor::left(10);
    left.apply_edit(10, 0, 5);
    assert_eq!(left.offset(), 10);

    // Right bias: move to end of inserted text
    let mut right = Anchor::right(10);
    right.apply_edit(10, 0, 5);
    assert_eq!(right.offset(), 15);
  }

  #[test]
  fn test_anchor_inside_deleted_region() {
    let mut anchor = Anchor::left(15);

    // Delete from 10 to 20
    anchor.apply_edit(10, 10, 0);
    assert_eq!(anchor.offset(), 10); // Moved to start of deleted region
  }

  #[test]
  fn test_anchor_set() {
    let set = AnchorSet::new();

    let id1 = set.create_left(10);
    let id2 = set.create_right(20);

    assert_eq!(set.len(), 2);
    assert_eq!(set.offset(id1), Some(10));
    assert_eq!(set.offset(id2), Some(20));

    // Apply edit: insert 5 chars at position 15
    set.apply_edit(15, 0, 5);

    assert_eq!(set.offset(id1), Some(10)); // Before edit
    assert_eq!(set.offset(id2), Some(25)); // After edit
  }
}
