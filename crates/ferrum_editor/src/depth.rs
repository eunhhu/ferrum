use ferrum_buffer::position::{Point, Position, Range};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tree_sitter::{Node, Tree};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct DepthRegion {
  pub start_byte: usize,
  pub end_byte: usize,
  pub depth: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScopeInfo {
  pub start_line: usize,
  pub end_line: usize,
  pub depth: u32,
  pub scope_name: String,
  pub scope_type: String, // "function", "class", "if", "for", etc.
}

pub struct DepthAnalyzer {
  pub depth_map: HashMap<Range, u32>,
  pub scopes: Vec<ScopeInfo>,
}

impl DepthAnalyzer {
  pub fn new() -> Self {
    Self {
      depth_map: HashMap::new(),
      scopes: Vec::new(),
    }
  }

  pub fn analyze(&mut self, tree: &Tree, source: &[u8]) {
    let root = tree.root_node();
    self.depth_map.clear();
    self.scopes.clear();
    self.traverse(root, 0, source);
  }

  fn traverse(&mut self, node: Node, depth: u32, source: &[u8]) {
    let increases_depth = matches!(
      node.kind(),
      "block"
        | "function_declaration"
        | "arrow_function"
        | "class_declaration"
        | "if_statement"
        | "for_statement"
        | "while_statement"
        | "try_statement"
        | "catch_clause"
        | "match_expression"
        | "match_arm"
        | "impl_item"
        | "method_declaration"
    );

    let current_depth = if increases_depth { depth + 1 } else { depth };

    if increases_depth {
      let start = node.start_position();
      let end = node.end_position();

      // Create Range using Point and Position
      let start_point = Point::new(start.row, start.column);
      let end_point = Point::new(end.row, end.column);

      // We need byte offsets for Position, but tree-sitter gives us bytes directly
      let start_pos = Position::new(start_point, node.start_byte());
      let end_pos = Position::new(end_point, node.end_byte());

      self
        .depth_map
        .insert(Range::new(start_pos, end_pos), current_depth);

      // Extract scope name for sticky headers
      let scope_name = self.extract_scope_name(&node, source);
      let scope_type = node.kind().to_string();

      self.scopes.push(ScopeInfo {
        start_line: start.row,
        end_line: end.row,
        depth: current_depth,
        scope_name,
        scope_type,
      });
    }

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
      self.traverse(child, current_depth, source);
    }
  }

  fn extract_scope_name(&self, node: &Node, source: &[u8]) -> String {
    match node.kind() {
      "function_declaration" | "method_declaration" => {
        // Try to find function name
        if let Some(name_node) = node.child_by_field_name("name") {
          return self.node_text(&name_node, source);
        }
      },
      "class_declaration" => {
        if let Some(name_node) = node.child_by_field_name("name") {
          return format!("class {}", self.node_text(&name_node, source));
        }
      },
      "if_statement" => return "if".to_string(),
      "for_statement" => return "for".to_string(),
      "while_statement" => return "while".to_string(),
      "try_statement" => return "try".to_string(),
      "catch_clause" => return "catch".to_string(),
      "impl_item" => {
        if let Some(type_node) = node.child_by_field_name("type") {
          return format!("impl {}", self.node_text(&type_node, source));
        }
      },
      _ => {},
    }

    // Fallback: use node kind
    node.kind().to_string()
  }

  fn node_text(&self, node: &Node, source: &[u8]) -> String {
    let start = node.start_byte();
    let end = node.end_byte();
    String::from_utf8_lossy(&source[start..end]).to_string()
  }

  pub fn get_depth(&self, position: &Position) -> u32 {
    self
      .depth_map
      .iter()
      .filter(|(range, _): &(&Range, _)| range.contains(position))
      .map(|(_, depth)| *depth)
      .max()
      .unwrap_or(0)
  }

  pub fn get_scopes_at_line(&self, line: usize) -> Vec<&ScopeInfo> {
    self
      .scopes
      .iter()
      .filter(|scope| line >= scope.start_line && line <= scope.end_line)
      .collect()
  }
}
