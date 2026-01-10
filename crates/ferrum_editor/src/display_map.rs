//! DisplayMap - Coordinate transformation between buffer and display
//!
//! The DisplayMap handles transformations between:
//! - Buffer coordinates (raw byte/char offsets and line/column in source)
//! - Display coordinates (what the user sees on screen)
//!
//! This includes:
//! - Soft wrapping (long lines wrapped to viewport width)
//! - Tab expansion (tabs converted to spaces for display)
//! - Code folding (hiding collapsed regions)
//! - Invisible character display

use ferrum_buffer::{Point, Position};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::ops::Range;

/// A point in display space
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
pub struct DisplayPoint {
    /// Display row (includes wrapped lines)
    pub row: u32,
    /// Display column (includes tab expansion)
    pub column: u32,
}

impl DisplayPoint {
    pub const fn new(row: u32, column: u32) -> Self {
        Self { row, column }
    }

    pub const fn zero() -> Self {
        Self { row: 0, column: 0 }
    }
}

impl Default for DisplayPoint {
    fn default() -> Self {
        Self::zero()
    }
}

/// A fold region in the buffer
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Fold {
    /// Start offset in the buffer
    pub start: usize,
    /// End offset in the buffer
    pub end: usize,
    /// Placeholder text to show when folded
    pub placeholder: String,
}

impl Fold {
    pub fn new(start: usize, end: usize, placeholder: impl Into<String>) -> Self {
        Self {
            start,
            end,
            placeholder: placeholder.into(),
        }
    }

    /// Check if a position is inside this fold
    pub fn contains(&self, offset: usize) -> bool {
        offset > self.start && offset < self.end
    }

    /// Get the collapsed length (placeholder length)
    pub fn display_len(&self) -> usize {
        self.placeholder.len()
    }
}

/// Configuration for the display map
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayMapConfig {
    /// Tab width in spaces
    pub tab_width: u32,
    /// Whether soft wrapping is enabled
    pub soft_wrap: bool,
    /// Wrap width (viewport columns), None for no wrap limit
    pub wrap_width: Option<u32>,
    /// Whether to show invisible characters
    pub show_invisibles: bool,
}

impl Default for DisplayMapConfig {
    fn default() -> Self {
        Self {
            tab_width: 4,
            soft_wrap: false,
            wrap_width: None,
            show_invisibles: false,
        }
    }
}

/// Snapshot of a wrapped line
#[derive(Debug, Clone)]
pub struct WrapInfo {
    /// Buffer line number
    pub buffer_line: u32,
    /// Wrap segments (start column for each wrapped segment)
    pub wraps: Vec<u32>,
}

/// The DisplayMap transforms between buffer and display coordinates
pub struct DisplayMap {
    config: RwLock<DisplayMapConfig>,
    /// Folds keyed by start offset
    folds: RwLock<BTreeMap<usize, Fold>>,
    /// Cached wrap information per buffer line
    wrap_cache: RwLock<BTreeMap<u32, WrapInfo>>,
    /// Total display rows (for scrollbar)
    total_rows: RwLock<u32>,
}

impl DisplayMap {
    /// Create a new DisplayMap with default config
    pub fn new() -> Self {
        Self {
            config: RwLock::new(DisplayMapConfig::default()),
            folds: RwLock::new(BTreeMap::new()),
            wrap_cache: RwLock::new(BTreeMap::new()),
            total_rows: RwLock::new(0),
        }
    }

    /// Create a DisplayMap with custom config
    pub fn with_config(config: DisplayMapConfig) -> Self {
        Self {
            config: RwLock::new(config),
            folds: RwLock::new(BTreeMap::new()),
            wrap_cache: RwLock::new(BTreeMap::new()),
            total_rows: RwLock::new(0),
        }
    }

    /// Get the current config
    pub fn config(&self) -> DisplayMapConfig {
        self.config.read().clone()
    }

    /// Update the config
    pub fn set_config(&self, config: DisplayMapConfig) {
        *self.config.write() = config;
        self.invalidate_cache();
    }

    /// Set tab width
    pub fn set_tab_width(&self, width: u32) {
        self.config.write().tab_width = width;
        self.invalidate_cache();
    }

    /// Set soft wrap enabled
    pub fn set_soft_wrap(&self, enabled: bool) {
        self.config.write().soft_wrap = enabled;
        self.invalidate_cache();
    }

    /// Set wrap width
    pub fn set_wrap_width(&self, width: Option<u32>) {
        self.config.write().wrap_width = width;
        self.invalidate_cache();
    }

    /// Get total display rows
    pub fn total_rows(&self) -> u32 {
        *self.total_rows.read()
    }

    // ========== Folding ==========

    /// Add a fold
    pub fn fold(&self, start: usize, end: usize, placeholder: impl Into<String>) {
        let fold = Fold::new(start, end, placeholder);
        self.folds.write().insert(start, fold);
        self.invalidate_cache();
    }

    /// Remove a fold at the given start position
    pub fn unfold(&self, start: usize) -> Option<Fold> {
        let fold = self.folds.write().remove(&start);
        if fold.is_some() {
            self.invalidate_cache();
        }
        fold
    }

    /// Toggle fold at position
    pub fn toggle_fold(&self, offset: usize) {
        let mut folds = self.folds.write();
        if folds.remove(&offset).is_none() {
            // No fold at this position - would need to create one
            // This would typically be done with syntax information
        }
        drop(folds);
        self.invalidate_cache();
    }

    /// Unfold all folds
    pub fn unfold_all(&self) {
        self.folds.write().clear();
        self.invalidate_cache();
    }

    /// Check if a position is folded
    pub fn is_folded(&self, offset: usize) -> bool {
        self.folds.read().values().any(|f| f.contains(offset))
    }

    /// Get all folds
    pub fn folds(&self) -> Vec<Fold> {
        self.folds.read().values().cloned().collect()
    }

    /// Get fold containing the offset
    pub fn fold_at(&self, offset: usize) -> Option<Fold> {
        self.folds.read().values().find(|f| f.contains(offset)).cloned()
    }

    // ========== Coordinate Transformation ==========

    /// Convert a buffer point to display point
    pub fn buffer_to_display(&self, point: Point, line_content: &str) -> DisplayPoint {
        let config = self.config.read();

        // Calculate display column with tab expansion
        let mut display_col = 0u32;
        for (i, ch) in line_content.chars().enumerate() {
            if i >= point.column {
                break;
            }
            if ch == '\t' {
                // Tab expands to next tab stop
                display_col += config.tab_width - (display_col % config.tab_width);
            } else {
                display_col += 1;
            }
        }

        // TODO: Handle soft wrapping and folding
        DisplayPoint::new(point.line as u32, display_col)
    }

    /// Convert a display point to buffer point
    pub fn display_to_buffer(&self, display: DisplayPoint, line_content: &str) -> Point {
        let config = self.config.read();

        // Find buffer column from display column
        let mut display_col = 0u32;
        let mut buffer_col = 0usize;

        for ch in line_content.chars() {
            if display_col >= display.column {
                break;
            }
            if ch == '\t' {
                display_col += config.tab_width - (display_col % config.tab_width);
            } else {
                display_col += 1;
            }
            buffer_col += 1;
        }

        // TODO: Handle soft wrapping and folding
        Point::new(display.row as usize, buffer_col)
    }

    /// Calculate the display width of a string segment
    pub fn display_width(&self, text: &str) -> u32 {
        let config = self.config.read();
        let mut width = 0u32;

        for ch in text.chars() {
            if ch == '\t' {
                width += config.tab_width - (width % config.tab_width);
            } else {
                // TODO: Handle wide characters (CJK, emoji)
                width += 1;
            }
        }

        width
    }

    /// Get visible lines for a display row range
    pub fn visible_buffer_lines(&self, display_start: u32, display_end: u32) -> Vec<u32> {
        // TODO: Handle folding and wrapping
        (display_start..display_end).collect()
    }

    // ========== Cache Management ==========

    /// Invalidate the wrap cache
    pub fn invalidate_cache(&self) {
        self.wrap_cache.write().clear();
    }

    /// Invalidate cache for specific lines
    pub fn invalidate_lines(&self, start_line: u32, end_line: u32) {
        let mut cache = self.wrap_cache.write();
        for line in start_line..=end_line {
            cache.remove(&line);
        }
    }

    /// Update after a buffer edit
    pub fn on_edit(&self, start_line: u32, old_end_line: u32, new_end_line: u32) {
        // Invalidate affected lines
        self.invalidate_lines(start_line, old_end_line.max(new_end_line));

        // Update folds that might be affected
        // TODO: Shift fold positions based on edit
    }
}

impl Default for DisplayMap {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_display_point() {
        let p = DisplayPoint::new(10, 20);
        assert_eq!(p.row, 10);
        assert_eq!(p.column, 20);
    }

    #[test]
    fn test_tab_expansion() {
        let dm = DisplayMap::new();
        dm.set_tab_width(4);

        // Tab at column 0 should expand to 4 spaces
        let text = "\thello";
        let buffer_point = Point::new(0, 1); // After the tab
        let display = dm.buffer_to_display(buffer_point, text);
        assert_eq!(display.column, 4);

        // Tab at column 2 should expand to column 4
        let text2 = "ab\tc";
        let buffer_point2 = Point::new(0, 3); // At 'c'
        let display2 = dm.buffer_to_display(buffer_point2, text2);
        assert_eq!(display2.column, 5); // 2 + 2 (tab to 4) + 1 = 5
    }

    #[test]
    fn test_fold() {
        let dm = DisplayMap::new();

        dm.fold(10, 50, "...");
        assert!(dm.is_folded(30));
        assert!(!dm.is_folded(5));
        assert!(!dm.is_folded(10)); // Start is not "inside"
        assert!(!dm.is_folded(50)); // End is not "inside"

        assert_eq!(dm.folds().len(), 1);

        dm.unfold(10);
        assert_eq!(dm.folds().len(), 0);
        assert!(!dm.is_folded(30));
    }

    #[test]
    fn test_display_width() {
        let dm = DisplayMap::new();
        dm.set_tab_width(4);

        assert_eq!(dm.display_width("hello"), 5);
        assert_eq!(dm.display_width("\t"), 4);
        assert_eq!(dm.display_width("a\tb"), 6); // 1 + 3 + 1 = 5? No: a=1, tab fills to 4, b=1 = 5
        // Actually: a at col 0 (width 1), tab from col 1 to col 4 (width 3), b at col 4 (width 1) = total 5
        assert_eq!(dm.display_width("a\tb"), 5);
    }
}
