//! Depth Analyzer - Analyze code nesting depth using Tree-sitter
//!
//! Provides depth analysis for Tree Viewer features:
//! - Depth-based background colors
//! - Sticky headers for scopes
//! - Tree fold to specific depth

use crate::syntax::{LanguageId, SyntaxManager};
use parking_lot::RwLock;
use ropey::Rope;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ops::Range;
use tree_sitter::Node;

/// A range in the buffer with depth info
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DepthRange {
    /// Start line (0-indexed)
    pub start_line: u32,
    /// End line (0-indexed, inclusive)
    pub end_line: u32,
    /// Nesting depth (0 = global scope)
    pub depth: u32,
    /// Node kind (e.g., "function_declaration", "if_statement")
    pub node_kind: String,
}

/// A sticky header for scope navigation
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StickyHeader {
    /// Line number where this header is defined
    pub line: u32,
    /// Header text (first line of the scope)
    pub text: String,
    /// Nesting depth
    pub depth: u32,
    /// Node kind
    pub node_kind: String,
    /// End line of this scope
    pub end_line: u32,
}

/// A foldable region
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FoldableRegion {
    /// Start line
    pub start_line: u32,
    /// End line (inclusive)
    pub end_line: u32,
    /// Depth of this region
    pub depth: u32,
    /// Node kind
    pub node_kind: String,
    /// Placeholder text when folded
    pub placeholder: String,
}

/// Depth analysis result
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DepthAnalysis {
    /// Depth ranges for each line
    pub depth_ranges: Vec<DepthRange>,
    /// Sticky headers
    pub sticky_headers: Vec<StickyHeader>,
    /// Foldable regions
    pub foldable_regions: Vec<FoldableRegion>,
    /// Maximum depth found
    pub max_depth: u32,
    /// Line count
    pub line_count: u32,
}

/// Analyzes code depth using tree-sitter AST
pub struct DepthAnalyzer {
    language: LanguageId,
    /// Cached analysis result
    cache: RwLock<Option<DepthAnalysis>>,
    /// Cache version
    cache_version: RwLock<u64>,
}

impl DepthAnalyzer {
    /// Create a new depth analyzer
    pub fn new(language: LanguageId) -> Self {
        Self {
            language,
            cache: RwLock::new(None),
            cache_version: RwLock::new(0),
        }
    }

    /// Analyze the buffer using the syntax tree
    pub fn analyze(&self, syntax: &SyntaxManager, rope: &Rope) -> DepthAnalysis {
        let mut analysis = DepthAnalysis {
            depth_ranges: Vec::new(),
            sticky_headers: Vec::new(),
            foldable_regions: Vec::new(),
            max_depth: 0,
            line_count: rope.len_lines() as u32,
        };

        syntax.with_tree(|tree| {
            let root = tree.root_node();
            let source = rope.to_string();

            // Traverse tree and collect depth info
            self.traverse_for_depth(root, 0, rope, &source, &mut analysis);

            // Sort ranges by start line
            analysis.depth_ranges.sort_by_key(|r| (r.start_line, r.depth));
            analysis.sticky_headers.sort_by_key(|h| h.line);
            analysis.foldable_regions.sort_by_key(|r| r.start_line);
        });

        // Cache the result
        *self.cache.write() = Some(analysis.clone());

        analysis
    }

    /// Traverse tree and collect depth information
    fn traverse_for_depth(
        &self,
        node: Node,
        depth: u32,
        rope: &Rope,
        source: &str,
        analysis: &mut DepthAnalysis,
    ) {
        let kind = node.kind();
        let increases_depth = self.increases_depth(kind);
        let current_depth = if increases_depth { depth + 1 } else { depth };

        // Update max depth
        if current_depth > analysis.max_depth {
            analysis.max_depth = current_depth;
        }

        // Check if this is a scope-creating node
        if increases_depth && node.start_position().row != node.end_position().row {
            let start_line = node.start_position().row as u32;
            let end_line = node.end_position().row as u32;

            // Add depth range
            analysis.depth_ranges.push(DepthRange {
                start_line,
                end_line,
                depth: current_depth,
                node_kind: kind.to_string(),
            });

            // Add sticky header
            let header_text = self.extract_header_text(node, source);
            analysis.sticky_headers.push(StickyHeader {
                line: start_line,
                text: header_text,
                depth: current_depth,
                node_kind: kind.to_string(),
                end_line,
            });

            // Add foldable region
            if end_line > start_line {
                let placeholder = self.get_fold_placeholder(kind);
                analysis.foldable_regions.push(FoldableRegion {
                    start_line,
                    end_line,
                    depth: current_depth,
                    node_kind: kind.to_string(),
                    placeholder,
                });
            }
        }

        // Recurse into children
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.traverse_for_depth(child, current_depth, rope, source, analysis);
        }
    }

    /// Check if a node kind increases nesting depth
    fn increases_depth(&self, kind: &str) -> bool {
        match self.language {
            LanguageId::Rust => matches!(
                kind,
                "function_item"
                    | "impl_item"
                    | "trait_item"
                    | "struct_item"
                    | "enum_item"
                    | "mod_item"
                    | "if_expression"
                    | "match_expression"
                    | "for_expression"
                    | "while_expression"
                    | "loop_expression"
                    | "block"
                    | "closure_expression"
            ),
            LanguageId::TypeScript | LanguageId::TypeScriptReact => matches!(
                kind,
                "function_declaration"
                    | "function"
                    | "arrow_function"
                    | "method_definition"
                    | "class_declaration"
                    | "class"
                    | "interface_declaration"
                    | "if_statement"
                    | "for_statement"
                    | "for_in_statement"
                    | "while_statement"
                    | "do_statement"
                    | "switch_statement"
                    | "try_statement"
                    | "catch_clause"
                    | "finally_clause"
                    | "object"
                    | "array"
            ),
            LanguageId::JavaScript | LanguageId::JavaScriptReact => matches!(
                kind,
                "function_declaration"
                    | "function"
                    | "arrow_function"
                    | "method_definition"
                    | "class_declaration"
                    | "class"
                    | "if_statement"
                    | "for_statement"
                    | "for_in_statement"
                    | "while_statement"
                    | "do_statement"
                    | "switch_statement"
                    | "try_statement"
                    | "catch_clause"
                    | "finally_clause"
                    | "object"
                    | "array"
            ),
            LanguageId::Python => matches!(
                kind,
                "function_definition"
                    | "class_definition"
                    | "if_statement"
                    | "for_statement"
                    | "while_statement"
                    | "with_statement"
                    | "try_statement"
                    | "except_clause"
                    | "finally_clause"
                    | "match_statement"
                    | "case_clause"
            ),
            LanguageId::Go => matches!(
                kind,
                "function_declaration"
                    | "method_declaration"
                    | "type_declaration"
                    | "if_statement"
                    | "for_statement"
                    | "switch_statement"
                    | "select_statement"
                    | "case_clause"
                    | "block"
            ),
            _ => matches!(
                kind,
                "function"
                    | "class"
                    | "if"
                    | "for"
                    | "while"
                    | "block"
                    | "object"
                    | "array"
            ),
        }
    }

    /// Extract header text for sticky headers
    fn extract_header_text(&self, node: Node, source: &str) -> String {
        let start = node.start_byte();
        let end_of_first_line = source[start..]
            .find('\n')
            .map(|i| start + i)
            .unwrap_or(node.end_byte());

        let text = &source[start..end_of_first_line];

        // Clean up the text
        text.trim()
            .trim_end_matches('{')
            .trim_end_matches(':')
            .trim()
            .to_string()
    }

    /// Get fold placeholder for a node kind
    fn get_fold_placeholder(&self, kind: &str) -> String {
        match kind {
            "function_item" | "function_declaration" | "function_definition" | "function" => {
                "fn { ... }".to_string()
            }
            "method_definition" | "method_declaration" => "method { ... }".to_string(),
            "class_declaration" | "class_definition" | "class" => "class { ... }".to_string(),
            "interface_declaration" => "interface { ... }".to_string(),
            "impl_item" => "impl { ... }".to_string(),
            "trait_item" => "trait { ... }".to_string(),
            "struct_item" => "struct { ... }".to_string(),
            "enum_item" => "enum { ... }".to_string(),
            "if_statement" | "if_expression" => "if { ... }".to_string(),
            "for_statement" | "for_expression" => "for { ... }".to_string(),
            "while_statement" | "while_expression" => "while { ... }".to_string(),
            "match_expression" | "match_statement" => "match { ... }".to_string(),
            "switch_statement" => "switch { ... }".to_string(),
            "try_statement" => "try { ... }".to_string(),
            "object" | "object_expression" => "{ ... }".to_string(),
            "array" | "array_expression" => "[ ... ]".to_string(),
            _ => "...".to_string(),
        }
    }

    /// Get depth at a specific line
    pub fn get_depth_at_line(&self, line: u32) -> u32 {
        let cache = self.cache.read();
        if let Some(analysis) = cache.as_ref() {
            // Find the deepest depth range containing this line
            analysis
                .depth_ranges
                .iter()
                .filter(|r| r.start_line <= line && r.end_line >= line)
                .map(|r| r.depth)
                .max()
                .unwrap_or(0)
        } else {
            0
        }
    }

    /// Get sticky headers visible at a scroll position
    pub fn get_sticky_headers_at(&self, scroll_line: u32, max_headers: usize) -> Vec<StickyHeader> {
        let cache = self.cache.read();
        if let Some(analysis) = cache.as_ref() {
            let mut stack: Vec<&StickyHeader> = Vec::new();

            for header in &analysis.sticky_headers {
                if header.line > scroll_line {
                    break;
                }

                // Pop headers that have ended
                while let Some(last) = stack.last() {
                    if last.end_line < scroll_line {
                        stack.pop();
                    } else if last.depth >= header.depth {
                        stack.pop();
                    } else {
                        break;
                    }
                }

                // Only add if this header's scope is still visible
                if header.end_line >= scroll_line {
                    stack.push(header);
                }
            }

            // Limit to max_headers
            if stack.len() > max_headers {
                stack = stack[stack.len() - max_headers..].to_vec();
            }

            stack.into_iter().cloned().collect()
        } else {
            Vec::new()
        }
    }

    /// Get foldable regions at or below a specific depth
    pub fn get_foldable_at_depth(&self, max_depth: u32) -> Vec<FoldableRegion> {
        let cache = self.cache.read();
        if let Some(analysis) = cache.as_ref() {
            analysis
                .foldable_regions
                .iter()
                .filter(|r| r.depth > max_depth)
                .cloned()
                .collect()
        } else {
            Vec::new()
        }
    }

    /// Get line depths for a range (for rendering)
    pub fn get_line_depths(&self, start_line: u32, end_line: u32) -> Vec<(u32, u32)> {
        let cache = self.cache.read();
        if let Some(analysis) = cache.as_ref() {
            let mut result = Vec::with_capacity((end_line - start_line + 1) as usize);

            for line in start_line..=end_line {
                let depth = analysis
                    .depth_ranges
                    .iter()
                    .filter(|r| r.start_line <= line && r.end_line >= line)
                    .map(|r| r.depth)
                    .max()
                    .unwrap_or(0);

                result.push((line, depth));
            }

            result
        } else {
            (start_line..=end_line).map(|l| (l, 0)).collect()
        }
    }

    /// Invalidate cache
    pub fn invalidate(&self) {
        *self.cache.write() = None;
    }

    /// Get cached analysis if available
    pub fn cached_analysis(&self) -> Option<DepthAnalysis> {
        self.cache.read().clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_depth_analysis() {
        let analyzer = DepthAnalyzer::new(LanguageId::Rust);
        let syntax = SyntaxManager::new(LanguageId::Rust).unwrap();
        let rope = Rope::from_str(
            r#"
fn main() {
    if true {
        println!("nested");
    }
}
"#,
        );

        syntax.parse(&rope).unwrap();
        let analysis = analyzer.analyze(&syntax, &rope);

        assert!(analysis.max_depth >= 2);
        assert!(!analysis.depth_ranges.is_empty());
        assert!(!analysis.sticky_headers.is_empty());
    }

    #[test]
    fn test_sticky_headers() {
        let analyzer = DepthAnalyzer::new(LanguageId::Rust);
        let syntax = SyntaxManager::new(LanguageId::Rust).unwrap();
        let rope = Rope::from_str(
            r#"
fn outer() {
    fn inner() {
        if true {
            // deep
        }
    }
}
"#,
        );

        syntax.parse(&rope).unwrap();
        analyzer.analyze(&syntax, &rope);

        // At line 4 (inside if), we should see outer, inner, and if headers
        let headers = analyzer.get_sticky_headers_at(4, 5);
        assert!(headers.len() >= 2);
    }

    #[test]
    fn test_line_depths() {
        let analyzer = DepthAnalyzer::new(LanguageId::TypeScript);
        let syntax = SyntaxManager::new(LanguageId::TypeScript).unwrap();
        let rope = Rope::from_str(
            r#"function foo() {
    if (true) {
        console.log('deep');
    }
}"#,
        );

        syntax.parse(&rope).unwrap();
        analyzer.analyze(&syntax, &rope);

        let depths = analyzer.get_line_depths(0, 4);
        assert_eq!(depths.len(), 5);

        // Line 2 (console.log) should be at depth 2 or more
        let depth_at_2 = analyzer.get_depth_at_line(2);
        assert!(depth_at_2 >= 2);
    }
}
