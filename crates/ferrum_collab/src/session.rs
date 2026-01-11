//! Collaboration session

use ferrum_core::id::SessionId;
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
