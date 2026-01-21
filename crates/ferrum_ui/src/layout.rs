//! Layout types

use serde::{Deserialize, Serialize};

/// Panel position
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PanelPosition {
  Left,
  Right,
  Bottom,
}

/// Split direction
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SplitDirection {
  Horizontal,
  Vertical,
}

/// Panel state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelState {
  pub position: PanelPosition,
  pub visible: bool,
  pub size: f32,
  pub min_size: f32,
  pub max_size: f32,
}

impl Default for PanelState {
  fn default() -> Self {
    Self {
      position: PanelPosition::Left,
      visible: true,
      size: 250.0,
      min_size: 150.0,
      max_size: 500.0,
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_panel_position_variants() {
    let positions = vec![
      PanelPosition::Left,
      PanelPosition::Right,
      PanelPosition::Bottom,
    ];

    for pos in positions {
      let json = serde_json::to_string(&pos).unwrap();
      let deserialized: PanelPosition = serde_json::from_str(&json).unwrap();
      assert_eq!(pos, deserialized);
    }
  }

  #[test]
  fn test_split_direction_variants() {
    let directions = vec![SplitDirection::Horizontal, SplitDirection::Vertical];

    for dir in directions {
      let json = serde_json::to_string(&dir).unwrap();
      let deserialized: SplitDirection = serde_json::from_str(&json).unwrap();
      assert_eq!(dir, deserialized);
    }
  }

  #[test]
  fn test_panel_state_default() {
    let state = PanelState::default();

    assert_eq!(state.position, PanelPosition::Left);
    assert!(state.visible);
    assert_eq!(state.size, 250.0);
    assert_eq!(state.min_size, 150.0);
    assert_eq!(state.max_size, 500.0);
  }

  #[test]
  fn test_panel_state_serialization() {
    let state = PanelState {
      position: PanelPosition::Right,
      visible: false,
      size: 300.0,
      min_size: 100.0,
      max_size: 600.0,
    };

    let json = serde_json::to_string(&state).unwrap();
    let deserialized: PanelState = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.position, PanelPosition::Right);
    assert!(!deserialized.visible);
    assert_eq!(deserialized.size, 300.0);
  }

  #[test]
  fn test_panel_state_size_bounds() {
    let state = PanelState::default();

    assert!(state.size >= state.min_size);
    assert!(state.size <= state.max_size);
  }
}
