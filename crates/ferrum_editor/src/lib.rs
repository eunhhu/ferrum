//! Ferrum Editor
//!
//! Editor state management, tabs, views, and workspace coordination.

pub mod display_map;
pub mod editor;
pub mod tabs;
pub mod workspace;

pub use display_map::{DisplayMap, DisplayMapConfig, DisplayPoint, Fold};
pub use editor::Editor;
pub use tabs::{Tab, TabGroup};
pub use workspace::Workspace;
