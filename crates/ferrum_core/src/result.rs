//! Result type alias for Ferrum operations

use crate::error::Error;

/// A specialized Result type for Ferrum operations
pub type Result<T, E = Error> = std::result::Result<T, E>;
