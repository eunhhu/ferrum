use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct FoldRegion {
  pub start_line: usize,
  pub end_line: usize,
  pub is_placeholder: bool, // true if it's just a placeholder for a folded region
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FoldState {
  /// Set of lines that are currently folded (hidden)
  pub folded_lines: HashSet<usize>,
  /// Map of start line to fold region info
  pub fold_ranges: HashMap<usize, FoldRegion>,
}

impl FoldState {
  pub fn new() -> Self {
    Self {
      folded_lines: HashSet::new(),
      fold_ranges: HashMap::new(),
    }
  }

  /// Add a potential fold range (calculated from AST)
  pub fn insert_fold_range(&mut self, start_line: usize, end_line: usize) {
    if start_line >= end_line {
      return;
    }
    self.fold_ranges.insert(
      start_line,
      FoldRegion {
        start_line,
        end_line,
        is_placeholder: false,
      },
    );
  }

  /// Toggle fold at a specific line
  pub fn toggle_fold(&mut self, line: usize) -> bool {
    if let Some(region) = self.fold_ranges.get(&line) {
      let is_folded = self.folded_lines.contains(&(line + 1));

      if is_folded {
        // Unfold
        for i in (line + 1)..=region.end_line {
          self.folded_lines.remove(&i);
        }
      } else {
        // Fold
        for i in (line + 1)..=region.end_line {
          self.folded_lines.insert(i);
        }
      }
      return true;
    }
    false
  }

  /// Check if a line is hidden
  pub fn is_line_hidden(&self, line: usize) -> bool {
    self.folded_lines.contains(&line)
  }

  /// Clear all fold ranges (e.g., on re-parse)
  /// Calculate fold ranges from the syntax tree
  pub fn calculate_folds(&mut self, tree: &tree_sitter::Tree) {
    let root = tree.root_node();
    self.fold_ranges.clear();
    self.traverse(root);
  }

  fn traverse(&mut self, node: tree_sitter::Node) {
    // Define foldable node kinds
    let is_foldable = matches!(
      node.kind(),
      "block"
        | "function_declaration"
        | "class_declaration"
        | "impl_item"
        | "mod_item"
        | "use_declaration"
        | "match_expression"
        | "if_statement"
        | "while_statement"
        | "for_statement"
        | "comment" // Block comments often come as multiple line_comment nodes slightly different
    );

    if is_foldable {
      let start = node.start_position();
      let end = node.end_position();

      // Only fold multi-line regions
      if end.row > start.row {
        self.insert_fold_range(start.row, end.row);
      }
    }

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
      self.traverse(child);
    }
  }
}
