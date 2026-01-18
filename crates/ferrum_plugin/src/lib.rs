//! Ferrum Plugin System
//!
//! Provides a sandboxed plugin runtime for extending Ferrum IDE.
//! Plugins can add commands, panels, themes, and more.

pub mod api;
pub mod manifest;
pub mod permission;
pub mod registry;
pub mod runtime;

pub use api::PluginApi;
pub use manifest::{PluginContribution, PluginManifest};
pub use permission::{Permission, PermissionManager};
pub use registry::{PluginInfo, PluginRegistry, PluginState};
pub use runtime::PluginRuntime;
