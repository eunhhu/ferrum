//! Ferrum Editor
//!
//! Editor state management, tabs, views, and workspace coordination.

pub mod editor;
pub mod tabs;
pub mod workspace;

pub use editor::Editor;
pub use tabs::{Tab, TabGroup};
pub use workspace::Workspace;
