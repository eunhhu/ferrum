//! IPC response types

use ferrum_core::prelude::*;
use serde::{Deserialize, Serialize};

/// Result type for IPC responses
pub type IpcResult<T> = std::result::Result<T, IpcError>;

/// IPC error that can be serialized to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcError {
    pub code: String,
    pub message: String,
    pub recoverable: bool,
}

impl From<Error> for IpcError {
    fn from(err: Error) -> Self {
        Self {
            code: format!("{:?}", err.kind()),
            message: err.to_string(),
            recoverable: err.is_recoverable(),
        }
    }
}

/// Standard IPC response wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum IpcResponse<T> {
    #[serde(rename = "success")]
    Success { data: T },
    #[serde(rename = "error")]
    Error { error: IpcError },
}

impl<T> IpcResponse<T> {
    /// Create a success response
    pub fn success(data: T) -> Self {
        Self::Success { data }
    }

    /// Create an error response
    pub fn error(err: impl Into<IpcError>) -> Self {
        Self::Error { error: err.into() }
    }

    /// Convert from a Result
    pub fn from_result(result: Result<T>) -> Self {
        match result {
            Ok(data) => Self::success(data),
            Err(err) => Self::error(err),
        }
    }
}

impl<T: Serialize> IpcResponse<T> {
    /// Serialize to JSON
    pub fn to_json(&self) -> Result<String> {
        serde_json::to_string(self).map_err(|e| Error::IpcSerializationError(e.to_string()))
    }
}

/// Helper macro for creating Tauri commands with proper error handling
#[macro_export]
macro_rules! tauri_command {
    ($name:ident, $($arg:ident: $ty:ty),* => $body:expr) => {
        #[tauri::command]
        pub async fn $name($($arg: $ty),*) -> IpcResponse<impl serde::Serialize> {
            IpcResponse::from_result($body)
        }
    };
}
