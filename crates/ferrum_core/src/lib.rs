//! Ferrum Core
//!
//! Core types, traits, and utilities shared across all Ferrum crates.
//! This crate provides the foundational building blocks for the IDE.

pub mod error;
pub mod event;
pub mod id;
pub mod result;
pub mod task;
pub mod telemetry;

// Re-exports for convenience
pub use error::{Error, ErrorContext, ErrorKind};
pub use id::{BufferId, FileId, ProjectId, SessionId, TabId, ViewId, WindowId};
pub use result::Result;

/// Application-wide constants
pub mod constants {
  /// Maximum file size for syntax highlighting (10MB)
  pub const MAX_HIGHLIGHT_FILE_SIZE: u64 = 10 * 1024 * 1024;

  /// Maximum undo history entries per buffer
  pub const MAX_UNDO_HISTORY: usize = 1000;

  /// Debounce interval for input (milliseconds)
  pub const INPUT_DEBOUNCE_MS: u64 = 16;

  /// Debounce interval for idle operations (milliseconds)
  pub const IDLE_DEBOUNCE_MS: u64 = 100;

  /// Default autosave interval (milliseconds)
  pub const AUTOSAVE_INTERVAL_MS: u64 = 30_000;
}

/// Prelude module for common imports
pub mod prelude {
  pub use crate::error::{Error, ErrorContext, ErrorKind};
  pub use crate::id::*;
  pub use crate::result::Result;
  pub use anyhow::Context as AnyhowContext;
  pub use tracing::{debug, error, info, instrument, trace, warn};
}
