//! Syntax highlighting using tree-sitter
//!
//! This module will be expanded to include tree-sitter parsing
//! and syntax highlighting. Currently provides type definitions.

use serde::{Deserialize, Serialize};

/// A syntax highlight
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Highlight {
    pub start: usize,
    pub end: usize,
    pub kind: HighlightKind,
}

/// Kinds of syntax highlights
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum HighlightKind {
    Keyword,
    String,
    Number,
    Comment,
    Function,
    Type,
    Variable,
    Parameter,
    Property,
    Operator,
    Punctuation,
    Constant,
    Label,
    Namespace,
    Attribute,
    Embedded,
    Error,
}

impl HighlightKind {
    /// Get the default color class for this highlight
    pub fn css_class(&self) -> &'static str {
        match self {
            HighlightKind::Keyword => "syntax-keyword",
            HighlightKind::String => "syntax-string",
            HighlightKind::Number => "syntax-number",
            HighlightKind::Comment => "syntax-comment",
            HighlightKind::Function => "syntax-function",
            HighlightKind::Type => "syntax-type",
            HighlightKind::Variable => "syntax-variable",
            HighlightKind::Parameter => "syntax-parameter",
            HighlightKind::Property => "syntax-property",
            HighlightKind::Operator => "syntax-operator",
            HighlightKind::Punctuation => "syntax-punctuation",
            HighlightKind::Constant => "syntax-constant",
            HighlightKind::Label => "syntax-label",
            HighlightKind::Namespace => "syntax-namespace",
            HighlightKind::Attribute => "syntax-attribute",
            HighlightKind::Embedded => "syntax-embedded",
            HighlightKind::Error => "syntax-error",
        }
    }
}

/// Result of parsing a document
#[derive(Debug, Clone)]
pub struct ParseResult {
    /// Syntax highlights
    pub highlights: Vec<Highlight>,
    /// Parse errors
    pub errors: Vec<SyntaxError>,
}

/// A syntax error from parsing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyntaxError {
    pub start: usize,
    pub end: usize,
    pub message: String,
}

impl ParseResult {
    /// Create an empty parse result
    pub fn empty() -> Self {
        Self {
            highlights: Vec::new(),
            errors: Vec::new(),
        }
    }

    /// Check if there are any errors
    pub fn has_errors(&self) -> bool {
        !self.errors.is_empty()
    }
}
