//! Plugin runtime for executing plugins
//!
//! Currently provides a stub implementation. Full WASM/QuickJS integration
//! will be added in a future phase.

use crate::api::PluginApi;
use crate::permission::{PermissionManager, PluginId};
use crate::registry::{PluginRegistry, PluginState};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Event types that plugins can subscribe to
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum PluginEvent {
  /// Editor content changed
  EditorContentChanged { editor_id: String },

  /// File opened
  FileOpened { path: String },

  /// File saved
  FileSaved { path: String },

  /// File closed
  FileClosed { path: String },

  /// Selection changed
  SelectionChanged { editor_id: String },

  /// Workspace opened
  WorkspaceOpened { path: String },

  /// Configuration changed
  ConfigurationChanged { section: String },

  /// Custom event
  Custom { name: String, data: String },
}

/// Plugin runtime state
pub struct PluginRuntimeState {
  /// Registered event handlers
  event_handlers: HashMap<PluginEvent, Vec<String>>,

  /// Plugin-specific state storage
  plugin_state: HashMap<String, serde_json::Value>,
}

impl PluginRuntimeState {
  pub fn new() -> Self {
    Self {
      event_handlers: HashMap::new(),
      plugin_state: HashMap::new(),
    }
  }

  /// Get a state value for the plugin
  pub fn get_state(&self, key: &str) -> Option<&serde_json::Value> {
    self.plugin_state.get(key)
  }

  /// Set a state value for the plugin
  pub fn set_state(&mut self, key: String, value: serde_json::Value) {
    self.plugin_state.insert(key, value);
  }

  /// Register an event handler
  pub fn register_handler(&mut self, event: PluginEvent, handler: String) {
    self
      .event_handlers
      .entry(event)
      .or_insert_with(Vec::new)
      .push(handler);
  }

  /// Get handlers for an event
  pub fn get_handlers(&self, event: &PluginEvent) -> Option<&Vec<String>> {
    self.event_handlers.get(event)
  }
}

impl Default for PluginRuntimeState {
  fn default() -> Self {
    Self::new()
  }
}

/// Plugin runtime manager
pub struct PluginRuntime {
  /// Plugin registry
  registry: Arc<PluginRegistry>,

  /// Permission manager
  permissions: Arc<PermissionManager>,

  /// Plugin API implementation
  #[allow(dead_code)]
  plugin_api: Arc<dyn PluginApi>,

  /// Runtime state per plugin
  states: RwLock<HashMap<PluginId, PluginRuntimeState>>,

  /// Registered commands (command_id -> plugin_id)
  commands: RwLock<HashMap<String, PluginId>>,
}

impl PluginRuntime {
  /// Create a new plugin runtime
  pub fn new(
    registry: Arc<PluginRegistry>,
    permissions: Arc<PermissionManager>,
    plugin_api: Arc<dyn PluginApi>,
  ) -> Self {
    Self {
      registry,
      permissions,
      plugin_api,
      states: RwLock::new(HashMap::new()),
      commands: RwLock::new(HashMap::new()),
    }
  }

  /// Load and activate a plugin
  pub async fn activate(&self, plugin_id: PluginId) -> Result<(), String> {
    let info = self.registry.get(plugin_id).ok_or("Plugin not found")?;

    // Set loading state
    self.registry.set_state(plugin_id, PluginState::Loading);

    // Parse and grant permissions
    self
      .permissions
      .grant_from_strings(plugin_id, &info.manifest.permissions);

    // Initialize runtime state
    {
      let mut states = self.states.write().await;
      states.insert(plugin_id, PluginRuntimeState::new());
    }

    // Register contributed commands
    {
      let mut commands = self.commands.write().await;
      for cmd in &info.manifest.contributes.commands {
        commands.insert(cmd.id.clone(), plugin_id);
      }
    }

    // TODO: Load and execute plugin main script
    // For now, just mark as active

    self.registry.set_state(plugin_id, PluginState::Active);

    tracing::info!(
      plugin_name = %info.manifest.name,
      "Plugin activated"
    );

    Ok(())
  }

  /// Deactivate a plugin
  pub async fn deactivate(&self, plugin_id: PluginId) -> Result<(), String> {
    let info = self.registry.get(plugin_id).ok_or("Plugin not found")?;

    // Remove runtime state
    {
      let mut states = self.states.write().await;
      states.remove(&plugin_id);
    }

    // Unregister commands
    {
      let mut commands = self.commands.write().await;
      commands.retain(|_, &mut pid| pid != plugin_id);
    }

    // Revoke permissions
    self.permissions.revoke_all(plugin_id);

    self.registry.set_state(plugin_id, PluginState::Installed);

    tracing::info!(
      plugin_name = %info.manifest.name,
      "Plugin deactivated"
    );

    Ok(())
  }

  /// Execute a command
  pub async fn execute_command(&self, command_id: &str) -> Result<(), String> {
    let plugin_id = {
      let commands = self.commands.read().await;
      commands.get(command_id).copied()
    };

    let plugin_id = plugin_id.ok_or_else(|| format!("Command '{}' not found", command_id))?;

    // Check if plugin is active
    let info = self.registry.get(plugin_id).ok_or("Plugin not found")?;

    if info.state != PluginState::Active {
      return Err("Plugin is not active".to_string());
    }

    // TODO: Execute the command handler in the plugin runtime
    tracing::debug!(
      command_id = %command_id,
      plugin_name = %info.manifest.name,
      "Executing command"
    );

    Ok(())
  }

  /// Emit an event to all active plugins
  pub async fn emit_event(&self, event: PluginEvent) {
    let states = self.states.read().await;

    for (plugin_id, state) in states.iter() {
      if let Some(handlers) = state.event_handlers.get(&event) {
        for handler in handlers {
          // TODO: Call the handler in the plugin runtime
          tracing::trace!(
            plugin_id = %plugin_id,
            handler = %handler,
            "Emitting event to plugin"
          );
        }
      }
    }
  }

  /// Get all registered commands
  pub async fn get_commands(&self) -> Vec<(String, PluginId)> {
    let commands = self.commands.read().await;
    commands.iter().map(|(k, v)| (k.clone(), *v)).collect()
  }

  /// Load all plugins from the registry
  pub async fn load_all(&self) -> Result<(), String> {
    let plugins = self.registry.scan_directory().map_err(|e| e.to_string())?;

    for plugin_info in plugins {
      let id = self.registry.register(plugin_info);
      // Don't auto-activate for now, let user control this
      tracing::info!(plugin_id = %id, "Registered plugin");
    }

    Ok(())
  }

  /// Get the plugin registry
  pub fn registry(&self) -> &Arc<PluginRegistry> {
    &self.registry
  }

  /// Get the permission manager
  pub fn permissions(&self) -> &Arc<PermissionManager> {
    &self.permissions
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::api::MockPluginApi;
  use crate::manifest::PluginManifest;
  use crate::registry::PluginInfo;
  use tempfile::tempdir;

  #[tokio::test]
  async fn test_plugin_lifecycle() {
    let dir = tempdir().unwrap();
    let registry = Arc::new(PluginRegistry::new(dir.path().to_path_buf()));
    let permissions = Arc::new(PermissionManager::new());
    let api = Arc::new(MockPluginApi);

    let runtime = PluginRuntime::new(registry.clone(), permissions, api);

    // Create a test plugin
    let manifest = PluginManifest {
      name: "test-plugin".to_string(),
      version: "1.0.0".to_string(),
      display_name: Some("Test Plugin".to_string()),
      description: None,
      author: None,
      repository: None,
      license: None,
      engine: None,
      main: "index.js".to_string(),
      permissions: vec!["editor.read".to_string()],
      contributes: Default::default(),
      dependencies: Default::default(),
      keywords: vec![],
      icon: None,
    };

    let info = PluginInfo::new(manifest, dir.path().to_path_buf());
    let id = registry.register(info);

    // Activate
    runtime.activate(id).await.unwrap();
    assert_eq!(registry.get(id).unwrap().state, PluginState::Active);

    // Deactivate
    runtime.deactivate(id).await.unwrap();
    assert_eq!(registry.get(id).unwrap().state, PluginState::Installed);
  }
}
