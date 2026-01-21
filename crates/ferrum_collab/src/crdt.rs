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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_insert_operation() {
    let peer_id = PeerId::new();
    let op = Operation::insert(peer_id, 0, "hello".to_string());

    assert_eq!(op.peer_id, peer_id);
    match op.kind {
      OperationKind::Insert { position, ref text } => {
        assert_eq!(position, 0);
        assert_eq!(text, "hello");
      },
      _ => panic!("Expected Insert operation"),
    }
  }

  #[test]
  fn test_delete_operation() {
    let peer_id = PeerId::new();
    let op = Operation::delete(peer_id, 5, 3);

    assert_eq!(op.peer_id, peer_id);
    match op.kind {
      OperationKind::Delete { position, length } => {
        assert_eq!(position, 5);
        assert_eq!(length, 3);
      },
      _ => panic!("Expected Delete operation"),
    }
  }

  #[test]
  fn test_operation_has_unique_id() {
    let peer_id = PeerId::new();
    let op1 = Operation::insert(peer_id, 0, "a".to_string());
    let op2 = Operation::insert(peer_id, 0, "b".to_string());

    assert_ne!(op1.id, op2.id);
  }

  #[test]
  fn test_operation_serialization() {
    let peer_id = PeerId::new();
    let op = Operation::insert(peer_id, 10, "test".to_string());

    let json = serde_json::to_string(&op).unwrap();
    let deserialized: Operation = serde_json::from_str(&json).unwrap();

    assert_eq!(op.id, deserialized.id);
    assert_eq!(op.peer_id, deserialized.peer_id);
  }
}
