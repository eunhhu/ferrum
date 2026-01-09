//! IPC protocol definitions

use ferrum_core::prelude::*;
use serde::{Deserialize, Serialize};

/// IPC message wrapper
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcMessage {
    pub id: RequestId,
    pub payload: IpcPayload,
}

/// IPC payload types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum IpcPayload {
    // File operations
    ReadFile { path: String },
    WriteFile { path: String, content: String },
    DeleteFile { path: String },
    ListDirectory { path: String },

    // Buffer operations
    BufferCreate { content: Option<String> },
    BufferInsert { buffer_id: BufferId, position: usize, text: String },
    BufferDelete { buffer_id: BufferId, start: usize, end: usize },
    BufferUndo { buffer_id: BufferId },
    BufferRedo { buffer_id: BufferId },

    // Editor operations
    OpenFile { path: String },
    SaveFile { buffer_id: BufferId, path: Option<String> },
    CloseTab { tab_id: TabId },

    // Search operations
    SearchFiles { query: String, limit: Option<usize> },
    SearchText { query: String, path: Option<String>, options: SearchOptions },

    // Git operations
    GitStatus { path: String },
    GitDiff { path: String },

    // LSP operations
    LspHover { buffer_id: BufferId, position: usize },
    LspCompletion { buffer_id: BufferId, position: usize },
    LspDefinition { buffer_id: BufferId, position: usize },

    // Settings
    GetSettings,
    UpdateSettings { settings: serde_json::Value },
}

/// Search options
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SearchOptions {
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub regex: bool,
    pub include_pattern: Option<String>,
    pub exclude_pattern: Option<String>,
}

/// Encode a message using MessagePack (for performance-critical paths)
pub fn encode_msgpack<T: Serialize>(value: &T) -> Result<Vec<u8>> {
    rmp_serde::to_vec(value).map_err(|e| Error::IpcSerializationError(e.to_string()))
}

/// Decode a message from MessagePack
pub fn decode_msgpack<'a, T: Deserialize<'a>>(bytes: &'a [u8]) -> Result<T> {
    rmp_serde::from_slice(bytes).map_err(|e| Error::IpcSerializationError(e.to_string()))
}
