//! Plugin manifest parsing and validation

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Plugin manifest (plugin.json)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
  /// Plugin unique identifier
  pub name: String,

  /// Plugin version (semver)
  pub version: String,

  /// Human-readable name
  #[serde(rename = "displayName")]
  pub display_name: Option<String>,

  /// Plugin description
  pub description: Option<String>,

  /// Author name or email
  pub author: Option<String>,

  /// Plugin homepage or repository URL
  pub repository: Option<String>,

  /// License identifier
  pub license: Option<String>,

  /// Required Ferrum version
  pub engine: Option<EngineRequirement>,

  /// Main entry point (relative path)
  pub main: String,

  /// Required permissions
  #[serde(default)]
  pub permissions: Vec<String>,

  /// Plugin contributions (commands, themes, etc.)
  #[serde(default)]
  pub contributes: PluginContribution,

  /// Plugin dependencies
  #[serde(default)]
  pub dependencies: HashMap<String, String>,

  /// Plugin keywords for search
  #[serde(default)]
  pub keywords: Vec<String>,

  /// Plugin icon path
  pub icon: Option<String>,
}

/// Engine version requirement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineRequirement {
  /// Required Ferrum version (semver range)
  pub ferrum: String,
}

/// Plugin contributions to the IDE
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PluginContribution {
  /// Registered commands
  #[serde(default)]
  pub commands: Vec<CommandContribution>,

  /// Registered themes
  #[serde(default)]
  pub themes: Vec<ThemeContribution>,

  /// Registered languages
  #[serde(default)]
  pub languages: Vec<LanguageContribution>,

  /// Registered panels
  #[serde(default)]
  pub panels: Vec<PanelContribution>,

  /// Registered keybindings
  #[serde(default)]
  pub keybindings: Vec<KeybindingContribution>,

  /// Registered menus
  #[serde(default)]
  pub menus: Vec<MenuContribution>,

  /// Registered configuration options
  #[serde(default)]
  pub configuration: Vec<ConfigurationContribution>,
}

/// Command contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandContribution {
  /// Command unique ID
  pub id: String,

  /// Command title for UI
  pub title: String,

  /// Optional category for grouping
  pub category: Option<String>,

  /// Default keybinding
  pub keybinding: Option<String>,

  /// When condition for visibility
  pub when: Option<String>,
}

/// Theme contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeContribution {
  /// Theme unique ID
  pub id: String,

  /// Theme display label
  pub label: String,

  /// Path to theme file
  pub path: String,

  /// Theme type (dark, light, high-contrast)
  #[serde(rename = "uiTheme")]
  pub ui_theme: Option<String>,
}

/// Language contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LanguageContribution {
  /// Language unique ID
  pub id: String,

  /// File extensions
  #[serde(default)]
  pub extensions: Vec<String>,

  /// File names (without extension)
  #[serde(default)]
  pub filenames: Vec<String>,

  /// Path to language configuration
  pub configuration: Option<String>,

  /// Path to TextMate grammar
  pub grammar: Option<String>,
}

/// Panel contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PanelContribution {
  /// Panel unique ID
  pub id: String,

  /// Panel title
  pub title: String,

  /// Panel position (left, right, bottom)
  pub position: Option<String>,

  /// Icon for the panel
  pub icon: Option<String>,
}

/// Keybinding contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeybindingContribution {
  /// Command to execute
  pub command: String,

  /// Key combination
  pub key: String,

  /// When condition
  pub when: Option<String>,

  /// Mac-specific key combination
  pub mac: Option<String>,

  /// Windows-specific key combination
  pub win: Option<String>,

  /// Linux-specific key combination
  pub linux: Option<String>,
}

/// Menu contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuContribution {
  /// Menu location ID
  pub location: String,

  /// Menu items
  pub items: Vec<MenuItem>,
}

/// Menu item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MenuItem {
  /// Command to execute
  pub command: String,

  /// Item title (optional, uses command title if not specified)
  pub title: Option<String>,

  /// Group for separators
  pub group: Option<String>,

  /// When condition
  pub when: Option<String>,
}

/// Configuration contribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationContribution {
  /// Configuration section title
  pub title: String,

  /// Configuration properties
  pub properties: HashMap<String, ConfigurationProperty>,
}

/// Configuration property
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationProperty {
  /// Property type (string, boolean, number, array, object)
  #[serde(rename = "type")]
  pub prop_type: String,

  /// Default value
  pub default: Option<serde_json::Value>,

  /// Description
  pub description: Option<String>,

  /// Enum values (for string type)
  #[serde(rename = "enum")]
  pub enum_values: Option<Vec<String>>,

  /// Minimum value (for number type)
  pub minimum: Option<f64>,

  /// Maximum value (for number type)
  pub maximum: Option<f64>,
}

impl PluginManifest {
  /// Load manifest from a JSON string
  pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
    serde_json::from_str(json)
  }

  /// Load manifest from a file path
  pub fn from_file(path: &PathBuf) -> Result<Self, std::io::Error> {
    let content = std::fs::read_to_string(path)?;
    serde_json::from_str(&content)
      .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))
  }

  /// Get the plugin ID (name@version)
  pub fn id(&self) -> String {
    format!("{}@{}", self.name, self.version)
  }

  /// Validate the manifest
  pub fn validate(&self) -> Result<(), String> {
    if self.name.is_empty() {
      return Err("Plugin name is required".to_string());
    }

    if self.version.is_empty() {
      return Err("Plugin version is required".to_string());
    }

    if self.main.is_empty() {
      return Err("Plugin main entry point is required".to_string());
    }

    // Validate name format (lowercase, alphanumeric, hyphens)
    if !self
      .name
      .chars()
      .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
    {
      return Err(
        "Plugin name must contain only lowercase letters, numbers, and hyphens".to_string(),
      );
    }

    Ok(())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_parse_manifest() {
    let json = r#"{
      "name": "my-plugin",
      "version": "1.0.0",
      "displayName": "My Plugin",
      "description": "A test plugin",
      "main": "dist/index.js",
      "permissions": ["workspace.read", "editor.modify"],
      "contributes": {
        "commands": [{
          "id": "myPlugin.hello",
          "title": "Say Hello"
        }]
      }
    }"#;

    let manifest = PluginManifest::from_json(json).unwrap();
    assert_eq!(manifest.name, "my-plugin");
    assert_eq!(manifest.version, "1.0.0");
    assert_eq!(manifest.permissions.len(), 2);
    assert_eq!(manifest.contributes.commands.len(), 1);
  }
}
