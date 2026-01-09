//! Selection handling

use serde::{Deserialize, Serialize};
use smallvec::SmallVec;

use crate::position::{Point, Position};

/// A single selection with anchor and head
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Selection {
    /// The fixed end of the selection (where selection started)
    pub anchor: Position,
    /// The moving end of the selection (cursor position)
    pub head: Position,
}

impl Selection {
    /// Create a new selection
    pub const fn new(anchor: Position, head: Position) -> Self {
        Self { anchor, head }
    }

    /// Create a cursor (empty selection)
    pub const fn cursor(position: Position) -> Self {
        Self {
            anchor: position,
            head: position,
        }
    }

    /// Check if this is a cursor (empty selection)
    pub const fn is_cursor(&self) -> bool {
        self.anchor.offset == self.head.offset
    }

    /// Get the start position (leftmost)
    pub fn start(&self) -> Position {
        if self.anchor.offset <= self.head.offset {
            self.anchor
        } else {
            self.head
        }
    }

    /// Get the end position (rightmost)
    pub fn end(&self) -> Position {
        if self.anchor.offset >= self.head.offset {
            self.anchor
        } else {
            self.head
        }
    }

    /// Check if the selection is reversed (head before anchor)
    pub const fn is_reversed(&self) -> bool {
        self.head.offset < self.anchor.offset
    }

    /// Get the length of the selection
    pub fn len(&self) -> usize {
        let start = self.start().offset;
        let end = self.end().offset;
        end - start
    }

    /// Check if the selection is empty
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Extend the selection to include a position
    pub fn extend_to(&self, position: Position) -> Self {
        Self {
            anchor: self.anchor,
            head: position,
        }
    }

    /// Move the cursor/selection by an offset
    pub fn translate(&self, delta: isize) -> Self {
        let translate_pos = |pos: Position| -> Position {
            let new_offset = if delta >= 0 {
                pos.offset.saturating_add(delta as usize)
            } else {
                pos.offset.saturating_sub((-delta) as usize)
            };
            Position::new(pos.point, new_offset)
        };

        Self {
            anchor: translate_pos(self.anchor),
            head: translate_pos(self.head),
        }
    }

    /// Collapse selection to a cursor at head
    pub fn collapse(&self) -> Self {
        Self::cursor(self.head)
    }

    /// Check if two selections overlap
    pub fn overlaps(&self, other: &Selection) -> bool {
        let self_start = self.start().offset;
        let self_end = self.end().offset;
        let other_start = other.start().offset;
        let other_end = other.end().offset;

        self_start < other_end && other_start < self_end
    }

    /// Merge two overlapping selections
    pub fn merge(&self, other: &Selection) -> Self {
        let start = std::cmp::min(self.start(), other.start());
        let end = std::cmp::max(self.end(), other.end());

        // Preserve direction based on which head is further
        if self.head.offset >= other.head.offset {
            Self::new(start, end)
        } else {
            Self::new(end, start)
        }
    }
}

impl Default for Selection {
    fn default() -> Self {
        Self::cursor(Position::zero())
    }
}

/// A set of selections (for multi-cursor support)
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelectionSet {
    /// The selections, sorted by position
    selections: SmallVec<[Selection; 4]>,
    /// Index of the primary selection
    primary: usize,
}

impl SelectionSet {
    /// Create a new selection set with a single cursor at origin
    pub fn new() -> Self {
        Self {
            selections: smallvec::smallvec![Selection::default()],
            primary: 0,
        }
    }

    /// Create a selection set with a single selection
    pub fn single(selection: Selection) -> Self {
        Self {
            selections: smallvec::smallvec![selection],
            primary: 0,
        }
    }

    /// Create a selection set from multiple selections
    pub fn from_selections(selections: impl IntoIterator<Item = Selection>) -> Self {
        let mut set = Self {
            selections: selections.into_iter().collect(),
            primary: 0,
        };
        set.normalize();
        set
    }

    /// Get the primary selection
    pub fn primary(&self) -> &Selection {
        &self.selections[self.primary]
    }

    /// Get all selections
    pub fn selections(&self) -> &[Selection] {
        &self.selections
    }

    /// Get the number of selections
    pub fn len(&self) -> usize {
        self.selections.len()
    }

    /// Check if empty (should never be)
    pub fn is_empty(&self) -> bool {
        self.selections.is_empty()
    }

    /// Add a selection
    pub fn add(&mut self, selection: Selection) {
        self.selections.push(selection);
        self.normalize();
    }

    /// Set the primary selection index
    pub fn set_primary(&mut self, index: usize) {
        if index < self.selections.len() {
            self.primary = index;
        }
    }

    /// Replace all selections with a single one
    pub fn set_single(&mut self, selection: Selection) {
        self.selections.clear();
        self.selections.push(selection);
        self.primary = 0;
    }

    /// Remove all selections except primary
    pub fn keep_primary_only(&mut self) {
        let primary = self.selections[self.primary];
        self.selections.clear();
        self.selections.push(primary);
        self.primary = 0;
    }

    /// Apply a transformation to all selections
    pub fn transform<F>(&mut self, f: F)
    where
        F: Fn(&Selection) -> Selection,
    {
        for selection in &mut self.selections {
            *selection = f(selection);
        }
        self.normalize();
    }

    /// Normalize selections: sort and merge overlapping
    fn normalize(&mut self) {
        if self.selections.is_empty() {
            self.selections.push(Selection::default());
            self.primary = 0;
            return;
        }

        // Sort by start position
        self.selections.sort_by_key(|s| s.start().offset);

        // Merge overlapping selections
        let mut merged: SmallVec<[Selection; 4]> = SmallVec::new();
        let mut primary_offset = self.selections[self.primary].start().offset;

        for selection in self.selections.drain(..) {
            if let Some(last) = merged.last_mut() {
                if last.overlaps(&selection) || last.end().offset == selection.start().offset {
                    *last = last.merge(&selection);
                    continue;
                }
            }
            merged.push(selection);
        }

        self.selections = merged;

        // Find new primary index
        self.primary = self
            .selections
            .iter()
            .position(|s| s.start().offset <= primary_offset && s.end().offset >= primary_offset)
            .unwrap_or(0);
    }
}

impl Default for SelectionSet {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pos(offset: usize) -> Position {
        Position::new(Point::zero(), offset)
    }

    #[test]
    fn test_selection_cursor() {
        let selection = Selection::cursor(pos(5));
        assert!(selection.is_cursor());
        assert_eq!(selection.len(), 0);
    }

    #[test]
    fn test_selection_direction() {
        let forward = Selection::new(pos(0), pos(10));
        assert!(!forward.is_reversed());
        assert_eq!(forward.start().offset, 0);
        assert_eq!(forward.end().offset, 10);

        let backward = Selection::new(pos(10), pos(0));
        assert!(backward.is_reversed());
        assert_eq!(backward.start().offset, 0);
        assert_eq!(backward.end().offset, 10);
    }

    #[test]
    fn test_selection_set_merge() {
        let mut set = SelectionSet::from_selections([
            Selection::new(pos(0), pos(5)),
            Selection::new(pos(3), pos(8)),  // Overlaps with first
            Selection::new(pos(10), pos(15)), // Separate
        ]);

        assert_eq!(set.len(), 2);
        assert_eq!(set.selections()[0].start().offset, 0);
        assert_eq!(set.selections()[0].end().offset, 8);
        assert_eq!(set.selections()[1].start().offset, 10);
    }
}
