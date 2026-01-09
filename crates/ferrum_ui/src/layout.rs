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
