//! Settings management

use ferrum_core::prelude::*;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Editor settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct EditorSettings {
  pub font_family: String,
  pub font_size: f32,
  pub line_height: f32,
  pub tab_size: usize,
  pub insert_spaces: bool,
  pub word_wrap: bool,
  pub minimap_enabled: bool,
  pub line_numbers: bool,
  pub highlight_active_line: bool,
  pub bracket_pair_colorization: bool,
  pub auto_save: bool,
  pub auto_save_delay_ms: u64,
  pub format_on_save: bool,
}

impl Default for EditorSettings {
  fn default() -> Self {
    Self {
      font_family: "JetBrains Mono".to_string(),
      font_size: 14.0,
      line_height: 1.5,
      tab_size: 4,
      insert_spaces: true,
      word_wrap: false,
      minimap_enabled: true,
      line_numbers: true,
      highlight_active_line: true,
      bracket_pair_colorization: true,
      auto_save: false,
      auto_save_delay_ms: 1000,
      format_on_save: true,
    }
  }
}

/// Terminal settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct TerminalSettings {
  pub shell: Option<String>,
  pub font_family: String,
  pub font_size: f32,
  pub cursor_style: String,
  pub cursor_blink: bool,
}

impl Default for TerminalSettings {
  fn default() -> Self {
    Self {
      shell: None,
      font_family: "JetBrains Mono".to_string(),
      font_size: 13.0,
      cursor_style: "block".to_string(),
      cursor_blink: true,
    }
  }
}

/// UI settings
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct UISettings {
  pub theme: String,
  pub sidebar_position: String,
  pub activity_bar_visible: bool,
  pub status_bar_visible: bool,
  pub tab_close_button: bool,
  pub breadcrumbs_enabled: bool,
}

impl Default for UISettings {
  fn default() -> Self {
    Self {
      theme: "Ferrum Dark".to_string(),
      sidebar_position: "left".to_string(),
      activity_bar_visible: true,
      status_bar_visible: true,
      tab_close_button: true,
      breadcrumbs_enabled: true,
    }
  }
}

/// All application settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(default)]
pub struct Settings {
  pub editor: EditorSettings,
  pub terminal: TerminalSettings,
  pub ui: UISettings,
}

impl Settings {
  /// Load settings from a file
  pub fn load(path: impl Into<PathBuf>) -> Result<Self> {
    let path = path.into();
    let content = std::fs::read_to_string(&path).map_err(|_| Error::FileNotFound { path })?;

    serde_json::from_str(&content).map_err(|e| Error::ConfigParseError(e.to_string()))
  }

  /// Save settings to a file
  pub fn save(&self, path: impl Into<PathBuf>) -> Result<()> {
    let path = path.into();
    let content = serde_json::to_string_pretty(self)
      .map_err(|e| Error::IpcSerializationError(e.to_string()))?;

    std::fs::write(&path, content)?;
    Ok(())
  }

  /// Merge with another settings (other takes precedence)
  pub fn merge(&mut self, other: serde_json::Value) {
    if let Ok(partial) = serde_json::from_value::<serde_json::Value>(other) {
      if let Ok(merged) = serde_json::to_value(&self) {
        if let Ok(result) = merge_json(merged, partial) {
          if let Ok(settings) = serde_json::from_value(result) {
            *self = settings;
          }
        }
      }
    }
  }
}

/// Merge two JSON values
fn merge_json(base: serde_json::Value, overlay: serde_json::Value) -> Result<serde_json::Value> {
  use serde_json::Value;

  match (base, overlay) {
    (Value::Object(mut base_map), Value::Object(overlay_map)) => {
      for (key, value) in overlay_map {
        let merged = if let Some(base_value) = base_map.remove(&key) {
          merge_json(base_value, value)?
        } else {
          value
        };
        base_map.insert(key, merged);
      }
      Ok(Value::Object(base_map))
    },
    (_, overlay) => Ok(overlay),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_default_settings() {
    let settings = Settings::default();
    assert_eq!(settings.editor.font_size, 14.0);
    assert_eq!(settings.editor.tab_size, 4);
  }

  #[test]
  fn test_settings_serialization() {
    let settings = Settings::default();
    let json = serde_json::to_string(&settings).unwrap();
    let parsed: Settings = serde_json::from_str(&json).unwrap();

    assert_eq!(settings.editor.font_size, parsed.editor.font_size);
  }
}
