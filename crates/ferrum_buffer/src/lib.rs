//! Ferrum Buffer
//!
//! Text buffer implementation using the ropey rope data structure.
//! Provides efficient editing operations, undo/redo, and integration
//! with tree-sitter for syntax parsing.

pub mod anchor;
pub mod buffer;
pub mod edit;
pub mod history;
pub mod position;
pub mod selection;
pub mod syntax;

pub use anchor::{Anchor, AnchorBias, AnchorId, AnchorSet};
pub use buffer::Buffer;
pub use edit::{Edit, EditKind};
pub use history::History;
pub use position::{Point, Position};
pub use selection::{Selection, SelectionSet};

// Re-export syntax types
pub use syntax::{
    AsyncParseResult, AsyncSyntaxManager, Highlight, HighlightKind, LanguageId, ParseResult,
    SyntaxError, SyntaxManager,
};
