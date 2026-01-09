//! Ferrum Git
//!
//! Git integration for version control operations.

pub mod repository;
pub mod status;

pub use repository::Repository;
pub use status::{FileStatus, GitStatus};
