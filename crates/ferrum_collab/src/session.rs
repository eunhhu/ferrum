//! Collaboration session

use ferrum_core::id::SessionId;
#[allow(unused_imports)]
use ferrum_core::prelude;
use parking_lot::RwLock;

use crate::crdt::Operation;
use crate::peer::Peer;

/// A collaboration session
pub struct CollabSession {
  id: SessionId,
  local_peer: Peer,
  peers: RwLock<Vec<Peer>>,
  operations: RwLock<Vec<Operation>>,
}

impl CollabSession {
  /// Create a new collaboration session as host
  pub fn create_host(name: impl Into<String>) -> Self {
    Self {
      id: SessionId::new(),
      local_peer: Peer::new(name, true),
      peers: RwLock::new(Vec::new()),
      operations: RwLock::new(Vec::new()),
    }
  }

  /// Join an existing session
  pub fn join(name: impl Into<String>) -> Self {
    Self {
      id: SessionId::new(),
      local_peer: Peer::new(name, false),
      peers: RwLock::new(Vec::new()),
      operations: RwLock::new(Vec::new()),
    }
  }

  /// Get session ID
  pub fn id(&self) -> SessionId {
    self.id
  }

  /// Get local peer
  pub fn local_peer(&self) -> &Peer {
    &self.local_peer
  }

  /// Get all peers
  pub fn peers(&self) -> Vec<Peer> {
    self.peers.read().clone()
  }

  /// Add a peer
  pub fn add_peer(&self, peer: Peer) {
    self.peers.write().push(peer);
  }

  /// Remove a peer
  pub fn remove_peer(&self, peer_id: &ferrum_core::id::PeerId) {
    self.peers.write().retain(|p| &p.id != peer_id);
  }

  /// Apply an operation
  pub fn apply_operation(&self, operation: Operation) {
    self.operations.write().push(operation);
  }

  /// Get all operations
  pub fn operations(&self) -> Vec<Operation> {
    self.operations.read().clone()
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use ferrum_core::id::PeerId;

  #[test]
  fn test_create_host_session() {
    let session = CollabSession::create_host("Host User");

    assert!(session.local_peer().is_host);
    assert_eq!(session.local_peer().name, "Host User");
    assert!(session.peers().is_empty());
  }

  #[test]
  fn test_join_session() {
    let session = CollabSession::join("Guest User");

    assert!(!session.local_peer().is_host);
    assert_eq!(session.local_peer().name, "Guest User");
  }

  #[test]
  fn test_add_and_remove_peer() {
    let session = CollabSession::create_host("Host");
    let peer = Peer::new("Guest", false);
    let peer_id = peer.id;

    session.add_peer(peer);
    assert_eq!(session.peers().len(), 1);

    session.remove_peer(&peer_id);
    assert!(session.peers().is_empty());
  }

  #[test]
  fn test_apply_operations() {
    let session = CollabSession::create_host("Host");
    let peer_id = PeerId::new();

    let op1 = Operation::insert(peer_id, 0, "Hello".to_string());
    let op2 = Operation::insert(peer_id, 5, " World".to_string());

    session.apply_operation(op1);
    session.apply_operation(op2);

    assert_eq!(session.operations().len(), 2);
  }

  #[test]
  fn test_session_has_unique_id() {
    let session1 = CollabSession::create_host("Host1");
    let session2 = CollabSession::create_host("Host2");

    assert_ne!(session1.id(), session2.id());
  }
}
