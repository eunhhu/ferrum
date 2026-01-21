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
  ReadFile {
    path: String,
  },
  WriteFile {
    path: String,
    content: String,
  },
  DeleteFile {
    path: String,
  },
  ListDirectory {
    path: String,
  },

  // Buffer operations
  BufferCreate {
    content: Option<String>,
  },
  BufferInsert {
    buffer_id: BufferId,
    position: usize,
    text: String,
  },
  BufferDelete {
    buffer_id: BufferId,
    start: usize,
    end: usize,
  },
  BufferUndo {
    buffer_id: BufferId,
  },
  BufferRedo {
    buffer_id: BufferId,
  },

  // Editor operations
  OpenFile {
    path: String,
  },
  SaveFile {
    buffer_id: BufferId,
    path: Option<String>,
  },
  CloseTab {
    tab_id: TabId,
  },
  GetDepthMap {
    buffer_id: BufferId,
  },
  GetFoldState {
    buffer_id: BufferId,
  },
  ToggleFold {
    buffer_id: BufferId,
    line: usize,
  },

  // Search operations
  SearchFiles {
    query: String,
    limit: Option<usize>,
  },
  SearchText {
    query: String,
    path: Option<String>,
    options: SearchOptions,
  },

  // Git operations
  GitStatus {
    path: String,
  },
  GitDiff {
    path: String,
  },

  // LSP operations
  LspHover {
    buffer_id: BufferId,
    position: usize,
  },
  LspCompletion {
    buffer_id: BufferId,
    position: usize,
  },
  LspDefinition {
    buffer_id: BufferId,
    position: usize,
  },

  // Settings
  GetSettings,
  UpdateSettings {
    settings: serde_json::Value,
  },
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_ipc_message_serialization() {
    let msg = IpcMessage {
      id: RequestId::new(),
      payload: IpcPayload::ReadFile {
        path: "/test/path.txt".to_string(),
      },
    };

    let json = serde_json::to_string(&msg).unwrap();
    let deserialized: IpcMessage = serde_json::from_str(&json).unwrap();

    assert_eq!(msg.id, deserialized.id);
    match deserialized.payload {
      IpcPayload::ReadFile { path } => assert_eq!(path, "/test/path.txt"),
      _ => panic!("Expected ReadFile payload"),
    }
  }

  #[test]
  fn test_msgpack_encode_decode_simple() {
    // Test simple struct serialization (tagged enums don't round-trip well with msgpack)
    let opts = SearchOptions {
      case_sensitive: true,
      whole_word: false,
      regex: true,
      include_pattern: Some("*.rs".to_string()),
      exclude_pattern: None,
    };

    let encoded = encode_msgpack(&opts).unwrap();
    let decoded: SearchOptions = decode_msgpack(&encoded).unwrap();

    assert_eq!(decoded.case_sensitive, opts.case_sensitive);
    assert_eq!(decoded.regex, opts.regex);
  }

  #[test]
  fn test_search_options_default() {
    let opts = SearchOptions::default();

    assert!(!opts.case_sensitive);
    assert!(!opts.whole_word);
    assert!(!opts.regex);
    assert!(opts.include_pattern.is_none());
    assert!(opts.exclude_pattern.is_none());
  }

  #[test]
  fn test_buffer_operations_payloads_json() {
    let buffer_id = BufferId::new();

    let payloads = vec![
      IpcPayload::BufferInsert {
        buffer_id,
        position: 10,
        text: "test".to_string(),
      },
      IpcPayload::BufferDelete {
        buffer_id,
        start: 5,
        end: 15,
      },
      IpcPayload::BufferUndo { buffer_id },
      IpcPayload::BufferRedo { buffer_id },
    ];

    for payload in payloads {
      let msg = IpcMessage {
        id: RequestId::new(),
        payload,
      };
      // Use JSON for tagged enums (better compatibility)
      let json = serde_json::to_string(&msg).unwrap();
      let _decoded: IpcMessage = serde_json::from_str(&json).unwrap();
    }
  }

  #[test]
  fn test_editor_operations_payloads() {
    let buffer_id = BufferId::new();
    let tab_id = TabId::new();

    let payloads = vec![
      IpcPayload::OpenFile {
        path: "/test.rs".to_string(),
      },
      IpcPayload::SaveFile {
        buffer_id,
        path: Some("/output.rs".to_string()),
      },
      IpcPayload::CloseTab { tab_id },
      IpcPayload::GetDepthMap { buffer_id },
      IpcPayload::GetFoldState { buffer_id },
      IpcPayload::ToggleFold { buffer_id, line: 5 },
    ];

    for payload in payloads {
      let json = serde_json::to_string(&payload).unwrap();
      assert!(!json.is_empty());
    }
  }

  #[test]
  fn test_lsp_operations_payloads() {
    let buffer_id = BufferId::new();

    let payloads = vec![
      IpcPayload::LspHover {
        buffer_id,
        position: 100,
      },
      IpcPayload::LspCompletion {
        buffer_id,
        position: 50,
      },
      IpcPayload::LspDefinition {
        buffer_id,
        position: 75,
      },
    ];

    for payload in payloads {
      let msg = IpcMessage {
        id: RequestId::new(),
        payload,
      };
      let json = serde_json::to_string(&msg).unwrap();
      let _: IpcMessage = serde_json::from_str(&json).unwrap();
    }
  }
}
