//! Collaboration peer

use ferrum_core::id::PeerId;
use serde::{Deserialize, Serialize};

/// A collaboration peer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peer {
  pub id: PeerId,
  pub name: String,
  pub color: String,
  pub is_host: bool,
}

impl Peer {
  /// Create a new peer
  pub fn new(name: impl Into<String>, is_host: bool) -> Self {
    Self {
      id: PeerId::new(),
      name: name.into(),
      color: Self::random_color(),
      is_host,
    }
  }

  /// Generate a random peer color
  fn random_color() -> String {
    let colors = [
      "#f38ba8", "#fab387", "#f9e2af", "#a6e3a1", "#89dceb", "#89b4fa", "#cba6f7", "#f5c2e7",
    ];
    let idx = rand_simple() % colors.len();
    colors[idx].to_string()
  }
}

/// Simple random number generator (no external deps)
fn rand_simple() -> usize {
  use std::time::{SystemTime, UNIX_EPOCH};
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_nanos() as usize)
    .unwrap_or(0)
}
