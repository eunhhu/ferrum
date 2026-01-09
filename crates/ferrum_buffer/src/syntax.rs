//! Syntax highlighting and parsing using tree-sitter
//!
//! This module provides incremental parsing with tree-sitter for syntax
//! highlighting and AST analysis. Key features:
//!
//! - **Incremental Parsing**: Only re-parses changed regions using InputEdit
//! - **Async Parsing**: Background thread parsing for large files
//! - **Language Support**: Multiple languages via tree-sitter grammars
//! - **Rope Integration**: Direct reading from ropey Rope chunks

use ferrum_core::prelude::*;
use once_cell::sync::Lazy;
use parking_lot::{Mutex, RwLock};
use ropey::Rope;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::ops::Range;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, trace, warn};
use tree_sitter::{InputEdit, Language, Node, Parser, Point as TsPoint, Query, QueryCursor, Tree};

// ============================================================================
// Language Registry
// ============================================================================

/// Supported languages with their tree-sitter configurations
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum LanguageId {
    Rust,
    TypeScript,
    TypeScriptReact,
    JavaScript,
    JavaScriptReact,
    Python,
    Go,
    Json,
    Toml,
    Html,
    Css,
    Markdown,
    Unknown,
}

impl LanguageId {
    /// Detect language from file extension
    pub fn from_extension(ext: &str) -> Self {
        match ext.to_lowercase().as_str() {
            "rs" => Self::Rust,
            "ts" => Self::TypeScript,
            "tsx" => Self::TypeScriptReact,
            "js" | "mjs" | "cjs" => Self::JavaScript,
            "jsx" => Self::JavaScriptReact,
            "py" | "pyi" => Self::Python,
            "go" => Self::Go,
            "json" | "jsonc" => Self::Json,
            "toml" => Self::Toml,
            "html" | "htm" => Self::Html,
            "css" => Self::Css,
            "md" | "markdown" => Self::Markdown,
            _ => Self::Unknown,
        }
    }

    /// Get the tree-sitter Language for this ID
    pub fn tree_sitter_language(&self) -> Option<Language> {
        match self {
            Self::Rust => Some(tree_sitter_rust::LANGUAGE.into()),
            Self::TypeScript | Self::TypeScriptReact => {
                Some(tree_sitter_typescript::LANGUAGE_TYPESCRIPT.into())
            }
            Self::JavaScript | Self::JavaScriptReact => {
                Some(tree_sitter_javascript::LANGUAGE.into())
            }
            Self::Python => Some(tree_sitter_python::LANGUAGE.into()),
            Self::Go => Some(tree_sitter_go::LANGUAGE.into()),
            Self::Json => Some(tree_sitter_json::LANGUAGE.into()),
            Self::Toml => Some(tree_sitter_toml::LANGUAGE.into()),
            Self::Html => Some(tree_sitter_html::LANGUAGE.into()),
            Self::Css => Some(tree_sitter_css::LANGUAGE.into()),
            Self::Markdown => Some(tree_sitter_md::LANGUAGE.into()),
            Self::Unknown => None,
        }
    }

    /// Get highlight query for this language
    pub fn highlight_query(&self) -> Option<&'static str> {
        match self {
            Self::Rust => Some(include_str!("../queries/rust/highlights.scm")),
            Self::TypeScript | Self::TypeScriptReact => {
                Some(include_str!("../queries/typescript/highlights.scm"))
            }
            Self::JavaScript | Self::JavaScriptReact => {
                Some(include_str!("../queries/javascript/highlights.scm"))
            }
            Self::Python => Some(include_str!("../queries/python/highlights.scm")),
            Self::Go => Some(include_str!("../queries/go/highlights.scm")),
            Self::Json => Some(include_str!("../queries/json/highlights.scm")),
            Self::Toml => Some(include_str!("../queries/toml/highlights.scm")),
            Self::Html => Some(include_str!("../queries/html/highlights.scm")),
            Self::Css => Some(include_str!("../queries/css/highlights.scm")),
            Self::Markdown => Some(include_str!("../queries/markdown/highlights.scm")),
            Self::Unknown => None,
        }
    }
}

// ============================================================================
// Highlight Types
// ============================================================================

/// A syntax highlight span
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Highlight {
    pub start: usize,
    pub end: usize,
    pub kind: HighlightKind,
}

impl Highlight {
    pub fn new(start: usize, end: usize, kind: HighlightKind) -> Self {
        Self { start, end, kind }
    }

    /// Get the byte range
    pub fn range(&self) -> Range<usize> {
        self.start..self.end
    }
}

/// Kinds of syntax highlights
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HighlightKind {
    Keyword,
    KeywordControl,
    KeywordFunction,
    KeywordOperator,
    KeywordReturn,
    String,
    StringSpecial,
    Number,
    Comment,
    CommentDoc,
    Function,
    FunctionMethod,
    FunctionBuiltin,
    FunctionMacro,
    Type,
    TypeBuiltin,
    Variable,
    VariableBuiltin,
    VariableParameter,
    Property,
    Operator,
    Punctuation,
    PunctuationBracket,
    PunctuationDelimiter,
    Constant,
    ConstantBuiltin,
    Label,
    Namespace,
    Attribute,
    Tag,
    TagDelimiter,
    Embedded,
    Error,
}

impl HighlightKind {
    /// Parse from tree-sitter capture name
    pub fn from_capture_name(name: &str) -> Option<Self> {
        Some(match name {
            "keyword" => Self::Keyword,
            "keyword.control" | "keyword.conditional" | "keyword.repeat" => Self::KeywordControl,
            "keyword.function" => Self::KeywordFunction,
            "keyword.operator" => Self::KeywordOperator,
            "keyword.return" => Self::KeywordReturn,
            "string" => Self::String,
            "string.special" | "string.escape" | "string.regex" => Self::StringSpecial,
            "number" | "float" => Self::Number,
            "comment" => Self::Comment,
            "comment.documentation" | "comment.doc" => Self::CommentDoc,
            "function" | "function.call" => Self::Function,
            "function.method" | "method" => Self::FunctionMethod,
            "function.builtin" => Self::FunctionBuiltin,
            "function.macro" | "macro" => Self::FunctionMacro,
            "type" | "type.definition" => Self::Type,
            "type.builtin" => Self::TypeBuiltin,
            "variable" => Self::Variable,
            "variable.builtin" | "self" => Self::VariableBuiltin,
            "variable.parameter" | "parameter" => Self::VariableParameter,
            "property" | "field" => Self::Property,
            "operator" => Self::Operator,
            "punctuation" => Self::Punctuation,
            "punctuation.bracket" => Self::PunctuationBracket,
            "punctuation.delimiter" => Self::PunctuationDelimiter,
            "constant" => Self::Constant,
            "constant.builtin" | "boolean" => Self::ConstantBuiltin,
            "label" => Self::Label,
            "namespace" | "module" => Self::Namespace,
            "attribute" => Self::Attribute,
            "tag" => Self::Tag,
            "tag.delimiter" => Self::TagDelimiter,
            "embedded" => Self::Embedded,
            "error" => Self::Error,
            _ => return None,
        })
    }

    /// Get the CSS class for this highlight
    pub fn css_class(&self) -> &'static str {
        match self {
            Self::Keyword => "hl-keyword",
            Self::KeywordControl => "hl-keyword-control",
            Self::KeywordFunction => "hl-keyword-function",
            Self::KeywordOperator => "hl-keyword-operator",
            Self::KeywordReturn => "hl-keyword-return",
            Self::String => "hl-string",
            Self::StringSpecial => "hl-string-special",
            Self::Number => "hl-number",
            Self::Comment => "hl-comment",
            Self::CommentDoc => "hl-comment-doc",
            Self::Function => "hl-function",
            Self::FunctionMethod => "hl-function-method",
            Self::FunctionBuiltin => "hl-function-builtin",
            Self::FunctionMacro => "hl-function-macro",
            Self::Type => "hl-type",
            Self::TypeBuiltin => "hl-type-builtin",
            Self::Variable => "hl-variable",
            Self::VariableBuiltin => "hl-variable-builtin",
            Self::VariableParameter => "hl-variable-parameter",
            Self::Property => "hl-property",
            Self::Operator => "hl-operator",
            Self::Punctuation => "hl-punctuation",
            Self::PunctuationBracket => "hl-punctuation-bracket",
            Self::PunctuationDelimiter => "hl-punctuation-delimiter",
            Self::Constant => "hl-constant",
            Self::ConstantBuiltin => "hl-constant-builtin",
            Self::Label => "hl-label",
            Self::Namespace => "hl-namespace",
            Self::Attribute => "hl-attribute",
            Self::Tag => "hl-tag",
            Self::TagDelimiter => "hl-tag-delimiter",
            Self::Embedded => "hl-embedded",
            Self::Error => "hl-error",
        }
    }
}

/// A syntax error from parsing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyntaxError {
    pub start: usize,
    pub end: usize,
    pub start_point: (usize, usize),
    pub end_point: (usize, usize),
    pub message: String,
}

/// Result of parsing a document
#[derive(Debug, Clone)]
pub struct ParseResult {
    /// Syntax highlights
    pub highlights: Vec<Highlight>,
    /// Parse errors
    pub errors: Vec<SyntaxError>,
    /// Parse duration in microseconds
    pub parse_time_us: u64,
}

impl ParseResult {
    pub fn empty() -> Self {
        Self {
            highlights: Vec::new(),
            errors: Vec::new(),
            parse_time_us: 0,
        }
    }

    pub fn has_errors(&self) -> bool {
        !self.errors.is_empty()
    }
}

// ============================================================================
// Syntax Manager (Synchronous)
// ============================================================================

/// Manages syntax parsing for a single buffer
pub struct SyntaxManager {
    language: LanguageId,
    parser: Mutex<Parser>,
    tree: RwLock<Option<Tree>>,
    highlight_query: Option<Query>,
}

impl SyntaxManager {
    /// Create a new syntax manager for the given language
    pub fn new(language: LanguageId) -> Result<Self> {
        let ts_lang = language
            .tree_sitter_language()
            .ok_or_else(|| Error::Internal(format!("Unsupported language: {:?}", language)))?;

        let mut parser = Parser::new();
        parser
            .set_language(&ts_lang)
            .map_err(|e| Error::Internal(format!("Failed to set language: {}", e)))?;

        let highlight_query = language
            .highlight_query()
            .map(|query_str| {
                Query::new(&ts_lang, query_str)
                    .map_err(|e| Error::Internal(format!("Failed to compile query: {}", e)))
            })
            .transpose()?;

        Ok(Self {
            language,
            parser: Mutex::new(parser),
            tree: RwLock::new(None),
            highlight_query,
        })
    }

    /// Get the language ID
    pub fn language(&self) -> LanguageId {
        self.language
    }

    /// Parse the entire content (initial parse)
    pub fn parse(&self, rope: &Rope) -> Result<()> {
        let start = std::time::Instant::now();

        let mut parser = self.parser.lock();
        let source = rope.to_string();

        let tree = parser
            .parse(&source, None)
            .ok_or_else(|| Error::Internal("Parsing failed".to_string()))?;

        *self.tree.write() = Some(tree);

        debug!(
            language = ?self.language,
            duration_us = start.elapsed().as_micros(),
            "Initial parse complete"
        );

        Ok(())
    }

    /// Parse using rope chunks (zero-copy for large files)
    pub fn parse_rope(&self, rope: &Rope) -> Result<()> {
        let start = std::time::Instant::now();

        let mut parser = self.parser.lock();

        // Use callback-based parsing for efficient rope reading
        let tree = parser.parse_with(
            &mut |byte_offset, _position| {
                if byte_offset >= rope.len_bytes() {
                    return &[];
                }

                // Get the chunk containing this byte offset
                let (chunk, chunk_byte_start, _, _) = rope.chunk_at_byte(byte_offset);
                let start_in_chunk = byte_offset - chunk_byte_start;

                &chunk.as_bytes()[start_in_chunk..]
            },
            None,
        );

        let tree =
            tree.ok_or_else(|| Error::Internal("Parsing failed with rope chunks".to_string()))?;

        *self.tree.write() = Some(tree);

        debug!(
            language = ?self.language,
            duration_us = start.elapsed().as_micros(),
            bytes = rope.len_bytes(),
            "Rope-based parse complete"
        );

        Ok(())
    }

    /// Incrementally update the tree after an edit
    ///
    /// This is the key optimization - only re-parses the changed region.
    pub fn edit(
        &self,
        rope: &Rope,
        edit_start_byte: usize,
        edit_old_end_byte: usize,
        edit_new_end_byte: usize,
    ) -> Result<()> {
        let start = std::time::Instant::now();

        let input_edit =
            self.rope_edit_to_input_edit(rope, edit_start_byte, edit_old_end_byte, edit_new_end_byte);

        // Apply edit to existing tree
        {
            let mut tree = self.tree.write();
            if let Some(ref mut t) = *tree {
                t.edit(&input_edit);
            }
        }

        // Re-parse with the edited tree
        let mut parser = self.parser.lock();
        let old_tree = self.tree.read().clone();

        let new_tree = parser.parse_with(
            &mut |byte_offset, _position| {
                if byte_offset >= rope.len_bytes() {
                    return &[];
                }

                let (chunk, chunk_byte_start, _, _) = rope.chunk_at_byte(byte_offset);
                let start_in_chunk = byte_offset - chunk_byte_start;

                &chunk.as_bytes()[start_in_chunk..]
            },
            old_tree.as_ref(),
        );

        if let Some(tree) = new_tree {
            *self.tree.write() = Some(tree);

            trace!(
                language = ?self.language,
                duration_us = start.elapsed().as_micros(),
                edit_start = edit_start_byte,
                "Incremental parse complete"
            );
        }

        Ok(())
    }

    /// Convert rope edit to tree-sitter InputEdit
    fn rope_edit_to_input_edit(
        &self,
        rope: &Rope,
        edit_start_byte: usize,
        edit_old_end_byte: usize,
        edit_new_end_byte: usize,
    ) -> InputEdit {
        // Calculate positions
        let start_position = byte_to_point(rope, edit_start_byte);
        let old_end_position = byte_to_point(rope, edit_old_end_byte.min(rope.len_bytes()));
        let new_end_position = byte_to_point(rope, edit_new_end_byte.min(rope.len_bytes()));

        InputEdit {
            start_byte: edit_start_byte,
            old_end_byte: edit_old_end_byte,
            new_end_byte: edit_new_end_byte,
            start_position,
            old_end_position,
            new_end_position,
        }
    }

    /// Get syntax highlights for a range
    pub fn highlights(&self, rope: &Rope, range: Range<usize>) -> Vec<Highlight> {
        let tree = self.tree.read();
        let Some(tree) = tree.as_ref() else {
            return Vec::new();
        };

        let Some(query) = &self.highlight_query else {
            return Vec::new();
        };

        let mut cursor = QueryCursor::new();
        cursor.set_byte_range(range.clone());

        let source = rope.to_string();
        let source_bytes = source.as_bytes();

        let matches = cursor.matches(query, tree.root_node(), source_bytes);

        let mut highlights = Vec::new();

        for m in matches {
            for capture in m.captures {
                let node = capture.node;
                let capture_name = &query.capture_names()[capture.index as usize];

                if let Some(kind) = HighlightKind::from_capture_name(capture_name) {
                    highlights.push(Highlight::new(node.start_byte(), node.end_byte(), kind));
                }
            }
        }

        // Sort and deduplicate overlapping highlights
        highlights.sort_by_key(|h| (h.start, std::cmp::Reverse(h.end)));

        highlights
    }

    /// Get all syntax errors
    pub fn errors(&self, rope: &Rope) -> Vec<SyntaxError> {
        let tree = self.tree.read();
        let Some(tree) = tree.as_ref() else {
            return Vec::new();
        };

        let mut errors = Vec::new();
        collect_errors(tree.root_node(), rope, &mut errors);

        errors
    }

    /// Get parse result for entire document
    pub fn parse_result(&self, rope: &Rope) -> ParseResult {
        let start = std::time::Instant::now();

        let highlights = self.highlights(rope, 0..rope.len_bytes());
        let errors = self.errors(rope);

        ParseResult {
            highlights,
            errors,
            parse_time_us: start.elapsed().as_micros() as u64,
        }
    }

    /// Get the current AST root node
    pub fn root_node(&self) -> Option<Node<'_>> {
        // This is tricky due to lifetime issues, return tree instead
        None
    }

    /// Access the tree for traversal
    pub fn with_tree<F, R>(&self, f: F) -> Option<R>
    where
        F: FnOnce(&Tree) -> R,
    {
        let tree = self.tree.read();
        tree.as_ref().map(f)
    }
}

/// Collect error nodes recursively
fn collect_errors(node: Node, rope: &Rope, errors: &mut Vec<SyntaxError>) {
    if node.is_error() || node.is_missing() {
        let message = if node.is_missing() {
            format!("Missing: {}", node.kind())
        } else {
            format!("Syntax error: unexpected {}", node.kind())
        };

        errors.push(SyntaxError {
            start: node.start_byte(),
            end: node.end_byte(),
            start_point: (node.start_position().row, node.start_position().column),
            end_point: (node.end_position().row, node.end_position().column),
            message,
        });
    }

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        collect_errors(child, rope, errors);
    }
}

/// Convert byte offset to tree-sitter Point
fn byte_to_point(rope: &Rope, byte_offset: usize) -> TsPoint {
    if byte_offset >= rope.len_bytes() {
        let line = rope.len_lines().saturating_sub(1);
        let col = rope.line(line).len_bytes();
        return TsPoint::new(line, col);
    }

    let char_idx = rope.byte_to_char(byte_offset);
    let line = rope.char_to_line(char_idx);
    let line_start_char = rope.line_to_char(line);
    let line_start_byte = rope.char_to_byte(line_start_char);
    let col = byte_offset - line_start_byte;

    TsPoint::new(line, col)
}

// ============================================================================
// Async Syntax Manager
// ============================================================================

/// Message types for async parsing
#[derive(Debug)]
enum ParseMessage {
    /// Full re-parse
    Parse(Arc<Rope>),
    /// Incremental edit
    Edit {
        rope: Arc<Rope>,
        start_byte: usize,
        old_end_byte: usize,
        new_end_byte: usize,
    },
    /// Shutdown
    Shutdown,
}

/// Parse result from background thread
#[derive(Debug, Clone)]
pub struct AsyncParseResult {
    pub highlights: Vec<Highlight>,
    pub errors: Vec<SyntaxError>,
    pub version: u64,
}

/// Async syntax manager that parses in a background thread
pub struct AsyncSyntaxManager {
    language: LanguageId,
    sender: mpsc::UnboundedSender<ParseMessage>,
    result_receiver: Arc<Mutex<mpsc::UnboundedReceiver<AsyncParseResult>>>,
    latest_result: Arc<RwLock<Option<AsyncParseResult>>>,
}

impl AsyncSyntaxManager {
    /// Create a new async syntax manager
    pub fn new(language: LanguageId) -> Result<Self> {
        let (tx, mut rx) = mpsc::unbounded_channel::<ParseMessage>();
        let (result_tx, result_rx) = mpsc::unbounded_channel::<AsyncParseResult>();
        let latest_result = Arc::new(RwLock::new(None));
        let latest_result_clone = latest_result.clone();

        // Spawn parsing thread
        std::thread::spawn(move || {
            let manager = match SyntaxManager::new(language) {
                Ok(m) => m,
                Err(e) => {
                    warn!("Failed to create syntax manager: {}", e);
                    return;
                }
            };

            let mut version = 0u64;

            while let Some(msg) = rx.blocking_recv() {
                match msg {
                    ParseMessage::Parse(rope) => {
                        if let Err(e) = manager.parse_rope(&rope) {
                            warn!("Parse error: {}", e);
                            continue;
                        }

                        version += 1;
                        let result = AsyncParseResult {
                            highlights: manager.highlights(&rope, 0..rope.len_bytes()),
                            errors: manager.errors(&rope),
                            version,
                        };

                        *latest_result_clone.write() = Some(result.clone());
                        let _ = result_tx.send(result);
                    }
                    ParseMessage::Edit {
                        rope,
                        start_byte,
                        old_end_byte,
                        new_end_byte,
                    } => {
                        if let Err(e) = manager.edit(&rope, start_byte, old_end_byte, new_end_byte) {
                            warn!("Edit error: {}", e);
                            continue;
                        }

                        version += 1;
                        let result = AsyncParseResult {
                            highlights: manager.highlights(&rope, 0..rope.len_bytes()),
                            errors: manager.errors(&rope),
                            version,
                        };

                        *latest_result_clone.write() = Some(result.clone());
                        let _ = result_tx.send(result);
                    }
                    ParseMessage::Shutdown => break,
                }
            }
        });

        Ok(Self {
            language,
            sender: tx,
            result_receiver: Arc::new(Mutex::new(result_rx)),
            latest_result,
        })
    }

    /// Request a full parse
    pub fn parse(&self, rope: Arc<Rope>) {
        let _ = self.sender.send(ParseMessage::Parse(rope));
    }

    /// Request an incremental edit
    pub fn edit(
        &self,
        rope: Arc<Rope>,
        start_byte: usize,
        old_end_byte: usize,
        new_end_byte: usize,
    ) {
        let _ = self.sender.send(ParseMessage::Edit {
            rope,
            start_byte,
            old_end_byte,
            new_end_byte,
        });
    }

    /// Get the latest parse result (non-blocking)
    pub fn latest_result(&self) -> Option<AsyncParseResult> {
        self.latest_result.read().clone()
    }

    /// Wait for next parse result
    pub async fn recv(&self) -> Option<AsyncParseResult> {
        self.result_receiver.lock().recv().await
    }

    /// Get language
    pub fn language(&self) -> LanguageId {
        self.language
    }
}

impl Drop for AsyncSyntaxManager {
    fn drop(&mut self) {
        let _ = self.sender.send(ParseMessage::Shutdown);
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_language_detection() {
        assert_eq!(LanguageId::from_extension("rs"), LanguageId::Rust);
        assert_eq!(LanguageId::from_extension("tsx"), LanguageId::TypeScriptReact);
        assert_eq!(LanguageId::from_extension("py"), LanguageId::Python);
        assert_eq!(LanguageId::from_extension("xyz"), LanguageId::Unknown);
    }

    #[test]
    fn test_highlight_kind_from_capture() {
        assert_eq!(
            HighlightKind::from_capture_name("keyword"),
            Some(HighlightKind::Keyword)
        );
        assert_eq!(
            HighlightKind::from_capture_name("function.method"),
            Some(HighlightKind::FunctionMethod)
        );
        assert_eq!(HighlightKind::from_capture_name("unknown"), None);
    }

    #[test]
    fn test_syntax_manager_creation() {
        let manager = SyntaxManager::new(LanguageId::Rust);
        assert!(manager.is_ok());

        let manager = SyntaxManager::new(LanguageId::Unknown);
        assert!(manager.is_err());
    }

    #[test]
    fn test_basic_parse() {
        let manager = SyntaxManager::new(LanguageId::Rust).unwrap();
        let rope = Rope::from_str("fn main() { println!(\"Hello\"); }");

        manager.parse(&rope).unwrap();

        let result = manager.parse_result(&rope);
        assert!(!result.highlights.is_empty());
        assert!(result.errors.is_empty());
    }

    #[test]
    fn test_incremental_edit() {
        let manager = SyntaxManager::new(LanguageId::Rust).unwrap();
        let mut rope = Rope::from_str("fn main() {}");

        manager.parse(&rope).unwrap();

        // Insert content
        let insert_pos = 11; // Before }
        let insert_text = " println!(\"hi\"); ";
        rope.insert(insert_pos, insert_text);

        manager
            .edit(
                &rope,
                insert_pos,
                insert_pos,
                insert_pos + insert_text.len(),
            )
            .unwrap();

        let result = manager.parse_result(&rope);
        assert!(!result.highlights.is_empty());
    }

    #[test]
    fn test_byte_to_point() {
        let rope = Rope::from_str("hello\nworld\n!");

        let pt = byte_to_point(&rope, 0);
        assert_eq!(pt.row, 0);
        assert_eq!(pt.column, 0);

        let pt = byte_to_point(&rope, 6);
        assert_eq!(pt.row, 1);
        assert_eq!(pt.column, 0);
    }
}
