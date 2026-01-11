//! Ferrum Search
//!
//! File and text search with fuzzy matching using nucleo.

pub mod file_search;
pub mod text_search;

pub use file_search::{FileMatch, FileSearcher};
pub use text_search::{SearchOptions, TextMatch, TextSearcher};
