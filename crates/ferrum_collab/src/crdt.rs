//! CRDT operations (placeholder for full implementation)

use ferrum_core::id::{OperationId, PeerId};
use serde::{Deserialize, Serialize};

/// A CRDT operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operation {
  pub id: OperationId,
  pub peer_id: PeerId,
  pub timestamp: u64,
  pub kind: OperationKind,
}

/// Kind of operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationKind {
  Insert { position: usize, text: String },
  Delete { position: usize, length: usize },
}

impl Operation {
  /// Create a new insert operation
  pub fn insert(peer_id: PeerId, position: usize, text: String) -> Self {
    Self {
      id: OperationId::new(),
      peer_id,
      timestamp: chrono::Utc::now().timestamp_millis() as u64,
      kind: OperationKind::Insert { position, text },
    }
  }

  /// Create a new delete operation
  pub fn delete(peer_id: PeerId, position: usize, length: usize) -> Self {
    Self {
      id: OperationId::new(),
      peer_id,
      timestamp: chrono::Utc::now().timestamp_millis() as u64,
      kind: OperationKind::Delete { position, length },
    }
  }
}
