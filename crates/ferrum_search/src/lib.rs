//! Ferrum Search
//!
//! File and text search with fuzzy matching using nucleo.

pub mod file_search;
pub mod text_search;

pub use file_search::{FileSearcher, FileMatch};
pub use text_search::{TextSearcher, SearchOptions, TextMatch};
