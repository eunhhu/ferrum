//! Ferrum Collaboration
//!
//! Real-time collaboration using CRDT-based conflict resolution.

pub mod crdt;
pub mod peer;
pub mod session;

pub use peer::Peer;
pub use session::CollabSession;
