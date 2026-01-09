//! Ferrum File System
//!
//! File system operations with watching, caching, and async support.

pub mod watcher;
pub mod walker;
pub mod file_info;

pub use file_info::FileInfo;
pub use watcher::FileWatcher;
pub use walker::FileWalker;
