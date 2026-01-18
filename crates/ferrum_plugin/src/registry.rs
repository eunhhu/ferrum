//! Plugin registry for managing installed plugins

use crate::manifest::PluginManifest;
use crate::permission::PluginId;
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;

/// Plugin state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PluginState {
  /// Plugin is installed but not activated
  Installed,

  /// Plugin is currently loading
  Loading,

  /// Plugin is active and running
  Active,

  /// Plugin encountered an error
  Error,

  /// Plugin is disabled by user
  Disabled,

  /// Plugin is being uninstalled
  Uninstalling,
}

/// Information about an installed plugin
#[derive(Debug, Clone)]
pub struct PluginInfo {
  /// Unique plugin ID
  pub id: PluginId,

  /// Plugin manifest
  pub manifest: PluginManifest,

  /// Plugin installation path
  pub path: PathBuf,

  /// Current state
  pub state: PluginState,

  /// Error message if state is Error
  pub error: Option<String>,

  /// Whether the plugin is a built-in
  pub builtin: bool,
}

impl PluginInfo {
  /// Create a new plugin info
  pub fn new(manifest: PluginManifest, path: PathBuf) -> Self {
    Self {
      id: PluginId::new_v4(),
      manifest,
      path,
      state: PluginState::Installed,
      error: None,
      builtin: false,
    }
  }

  /// Get the display name
  pub fn display_name(&self) -> &str {
    self
      .manifest
      .display_name
      .as_deref()
      .unwrap_or(&self.manifest.name)
  }
}

/// Registry for managing all plugins
pub struct PluginRegistry {
  /// All registered plugins
  plugins: DashMap<PluginId, Arc<PluginInfo>>,

  /// Plugin name to ID mapping
  name_to_id: DashMap<String, PluginId>,

  /// Plugin directory
  plugins_dir: PathBuf,
}

impl PluginRegistry {
  /// Create a new plugin registry
  pub fn new(plugins_dir: PathBuf) -> Self {
    Self {
      plugins: DashMap::new(),
      name_to_id: DashMap::new(),
      plugins_dir,
    }
  }

  /// Get the plugins directory
  pub fn plugins_dir(&self) -> &PathBuf {
    &self.plugins_dir
  }

  /// Register a plugin
  pub fn register(&self, info: PluginInfo) -> PluginId {
    let id = info.id;
    let name = info.manifest.name.clone();

    self.plugins.insert(id, Arc::new(info));
    self.name_to_id.insert(name, id);

    id
  }

  /// Unregister a plugin
  pub fn unregister(&self, id: PluginId) -> Option<Arc<PluginInfo>> {
    if let Some((_, info)) = self.plugins.remove(&id) {
      self.name_to_id.remove(&info.manifest.name);
      Some(info)
    } else {
      None
    }
  }

  /// Get a plugin by ID
  pub fn get(&self, id: PluginId) -> Option<Arc<PluginInfo>> {
    self.plugins.get(&id).map(|r| r.clone())
  }

  /// Get a plugin by name
  pub fn get_by_name(&self, name: &str) -> Option<Arc<PluginInfo>> {
    self
      .name_to_id
      .get(name)
      .and_then(|id| self.plugins.get(&id).map(|r| r.clone()))
  }

  /// Get all plugins
  pub fn all(&self) -> Vec<Arc<PluginInfo>> {
    self.plugins.iter().map(|r| r.value().clone()).collect()
  }

  /// Get all active plugins
  pub fn active(&self) -> Vec<Arc<PluginInfo>> {
    self
      .plugins
      .iter()
      .filter(|r| r.value().state == PluginState::Active)
      .map(|r| r.value().clone())
      .collect()
  }

  /// Update plugin state
  pub fn set_state(&self, id: PluginId, state: PluginState) {
    if let Some(mut entry) = self.plugins.get_mut(&id) {
      let info = Arc::make_mut(&mut entry);
      info.state = state;
      if state != PluginState::Error {
        info.error = None;
      }
    }
  }

  /// Set plugin error
  pub fn set_error(&self, id: PluginId, error: String) {
    if let Some(mut entry) = self.plugins.get_mut(&id) {
      let info = Arc::make_mut(&mut entry);
      info.state = PluginState::Error;
      info.error = Some(error);
    }
  }

  /// Check if a plugin is installed
  pub fn is_installed(&self, name: &str) -> bool {
    self.name_to_id.contains_key(name)
  }

  /// Get plugin count
  pub fn count(&self) -> usize {
    self.plugins.len()
  }

  /// Scan plugins directory and load manifests
  pub fn scan_directory(&self) -> Result<Vec<PluginInfo>, std::io::Error> {
    let mut plugins = Vec::new();

    if !self.plugins_dir.exists() {
      std::fs::create_dir_all(&self.plugins_dir)?;
      return Ok(plugins);
    }

    for entry in std::fs::read_dir(&self.plugins_dir)? {
      let entry = entry?;
      let path = entry.path();

      if path.is_dir() {
        let manifest_path = path.join("plugin.json");
        if manifest_path.exists() {
          match PluginManifest::from_file(&manifest_path) {
            Ok(manifest) => {
              let info = PluginInfo::new(manifest, path);
              plugins.push(info);
            },
            Err(e) => {
              tracing::warn!(
                "Failed to load plugin manifest from {:?}: {}",
                manifest_path,
                e
              );
            },
          }
        }
      }
    }

    Ok(plugins)
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::tempdir;

  #[test]
  fn test_register_plugin() {
    let dir = tempdir().unwrap();
    let registry = PluginRegistry::new(dir.path().to_path_buf());

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
      permissions: vec![],
      contributes: Default::default(),
      dependencies: Default::default(),
      keywords: vec![],
      icon: None,
    };

    let info = PluginInfo::new(manifest, dir.path().to_path_buf());
    let id = registry.register(info);

    assert!(registry.get(id).is_some());
    assert!(registry.get_by_name("test-plugin").is_some());
    assert_eq!(registry.count(), 1);
  }
}
