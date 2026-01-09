//! Error types for Ferrum IDE
//!
//! This module provides a unified error handling strategy using `thiserror`
//! for defining error types and `anyhow` for error propagation with context.

use std::path::PathBuf;
use thiserror::Error;

/// The primary error type for Ferrum operations
#[derive(Error, Debug)]
pub enum Error {
    // ===== File System Errors =====
    #[error("File not found: {path}")]
    FileNotFound { path: PathBuf },

    #[error("Permission denied: {path}")]
    PermissionDenied { path: PathBuf },

    #[error("File too large: {path} ({size} bytes, max {max} bytes)")]
    FileTooLarge { path: PathBuf, size: u64, max: u64 },

    #[error("Invalid file encoding in {path}: expected UTF-8")]
    InvalidEncoding { path: PathBuf },

    #[error("Directory operation failed: {0}")]
    DirectoryError(String),

    // ===== Buffer Errors =====
    #[error("Buffer not found: {0}")]
    BufferNotFound(crate::id::BufferId),

    #[error("Buffer is read-only")]
    BufferReadOnly,

    #[error("Invalid position: line {line}, column {column}")]
    InvalidPosition { line: usize, column: usize },

    #[error("Invalid range: {start}..{end}")]
    InvalidRange { start: usize, end: usize },

    // ===== Editor Errors =====
    #[error("No active editor")]
    NoActiveEditor,

    #[error("Tab not found: {0}")]
    TabNotFound(crate::id::TabId),

    #[error("View not found: {0}")]
    ViewNotFound(crate::id::ViewId),

    // ===== LSP Errors =====
    #[error("LSP server not running for language: {language}")]
    LspNotRunning { language: String },

    #[error("LSP request timeout: {method}")]
    LspTimeout { method: String },

    #[error("LSP initialization failed: {reason}")]
    LspInitFailed { reason: String },

    // ===== Git Errors =====
    #[error("Not a git repository: {path}")]
    NotGitRepo { path: PathBuf },

    #[error("Git operation failed: {operation} - {reason}")]
    GitOperationFailed { operation: String, reason: String },

    // ===== IPC Errors =====
    #[error("IPC serialization failed: {0}")]
    IpcSerializationError(String),

    #[error("IPC channel closed")]
    IpcChannelClosed,

    #[error("IPC timeout after {ms}ms")]
    IpcTimeout { ms: u64 },

    // ===== Configuration Errors =====
    #[error("Invalid configuration: {field} - {reason}")]
    InvalidConfig { field: String, reason: String },

    #[error("Configuration file parse error: {0}")]
    ConfigParseError(String),

    // ===== Plugin Errors =====
    #[error("Plugin load failed: {name} - {reason}")]
    PluginLoadFailed { name: String, reason: String },

    #[error("Plugin not found: {name}")]
    PluginNotFound { name: String },

    // ===== Generic Errors =====
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

/// Error kind for categorizing errors
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum ErrorKind {
    FileSystem,
    Buffer,
    Editor,
    Lsp,
    Git,
    Ipc,
    Config,
    Plugin,
    Internal,
}

impl Error {
    /// Get the kind of this error
    pub fn kind(&self) -> ErrorKind {
        match self {
            Error::FileNotFound { .. }
            | Error::PermissionDenied { .. }
            | Error::FileTooLarge { .. }
            | Error::InvalidEncoding { .. }
            | Error::DirectoryError(_)
            | Error::Io(_) => ErrorKind::FileSystem,

            Error::BufferNotFound(_)
            | Error::BufferReadOnly
            | Error::InvalidPosition { .. }
            | Error::InvalidRange { .. } => ErrorKind::Buffer,

            Error::NoActiveEditor | Error::TabNotFound(_) | Error::ViewNotFound(_) => {
                ErrorKind::Editor
            }

            Error::LspNotRunning { .. } | Error::LspTimeout { .. } | Error::LspInitFailed { .. } => {
                ErrorKind::Lsp
            }

            Error::NotGitRepo { .. } | Error::GitOperationFailed { .. } => ErrorKind::Git,

            Error::IpcSerializationError(_) | Error::IpcChannelClosed | Error::IpcTimeout { .. } => {
                ErrorKind::Ipc
            }

            Error::InvalidConfig { .. } | Error::ConfigParseError(_) => ErrorKind::Config,

            Error::PluginLoadFailed { .. } | Error::PluginNotFound { .. } => ErrorKind::Plugin,

            Error::Json(_) | Error::Internal(_) | Error::Other(_) => ErrorKind::Internal,
        }
    }

    /// Check if this error is recoverable
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self,
            Error::FileNotFound { .. }
                | Error::PermissionDenied { .. }
                | Error::BufferNotFound(_)
                | Error::LspTimeout { .. }
                | Error::IpcTimeout { .. }
        )
    }

    /// Check if this error should be reported to telemetry
    pub fn should_report(&self) -> bool {
        matches!(
            self.kind(),
            ErrorKind::Internal | ErrorKind::Plugin | ErrorKind::Ipc
        )
    }
}

/// Extension trait for adding context to errors
pub trait ErrorContext<T> {
    /// Add context to an error
    fn context<C>(self, context: C) -> crate::Result<T>
    where
        C: std::fmt::Display + Send + Sync + 'static;

    /// Add context lazily
    fn with_context<C, F>(self, f: F) -> crate::Result<T>
    where
        C: std::fmt::Display + Send + Sync + 'static,
        F: FnOnce() -> C;
}

impl<T, E> ErrorContext<T> for std::result::Result<T, E>
where
    E: std::error::Error + Send + Sync + 'static,
{
    fn context<C>(self, context: C) -> crate::Result<T>
    where
        C: std::fmt::Display + Send + Sync + 'static,
    {
        self.map_err(|e| Error::Other(anyhow::Error::from(e).context(context)))
    }

    fn with_context<C, F>(self, f: F) -> crate::Result<T>
    where
        C: std::fmt::Display + Send + Sync + 'static,
        F: FnOnce() -> C,
    {
        self.map_err(|e| Error::Other(anyhow::Error::from(e).context(f())))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_kind() {
        let err = Error::FileNotFound {
            path: PathBuf::from("/test"),
        };
        assert_eq!(err.kind(), ErrorKind::FileSystem);

        let err = Error::BufferNotFound(crate::id::BufferId::new());
        assert_eq!(err.kind(), ErrorKind::Buffer);
    }

    #[test]
    fn test_error_recoverable() {
        let recoverable = Error::FileNotFound {
            path: PathBuf::from("/test"),
        };
        assert!(recoverable.is_recoverable());

        let not_recoverable = Error::Internal("test".to_string());
        assert!(!not_recoverable.is_recoverable());
    }
}
