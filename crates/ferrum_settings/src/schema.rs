//! Settings schema for validation and documentation

use serde::{Deserialize, Serialize};

/// Type of a setting value
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SettingType {
  String,
  Number,
  Boolean,
  Array,
  Object,
}

/// A setting definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingDefinition {
  pub key: String,
  pub r#type: SettingType,
  pub default: serde_json::Value,
  pub description: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub enum_values: Option<Vec<String>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub minimum: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub maximum: Option<f64>,
}

/// Settings schema
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsSchema {
  pub version: String,
  pub settings: Vec<SettingDefinition>,
}

impl SettingsSchema {
  /// Get the built-in schema
  pub fn builtin() -> Self {
    Self {
      version: "1.0".to_string(),
      settings: vec![
        SettingDefinition {
          key: "editor.fontSize".to_string(),
          r#type: SettingType::Number,
          default: serde_json::json!(14.0),
          description: "Font size in pixels".to_string(),
          enum_values: None,
          minimum: Some(8.0),
          maximum: Some(72.0),
        },
        SettingDefinition {
          key: "editor.tabSize".to_string(),
          r#type: SettingType::Number,
          default: serde_json::json!(4),
          description: "Number of spaces per tab".to_string(),
          enum_values: None,
          minimum: Some(1.0),
          maximum: Some(8.0),
        },
        SettingDefinition {
          key: "editor.wordWrap".to_string(),
          r#type: SettingType::Boolean,
          default: serde_json::json!(false),
          description: "Enable word wrap".to_string(),
          enum_values: None,
          minimum: None,
          maximum: None,
        },
        SettingDefinition {
          key: "ui.theme".to_string(),
          r#type: SettingType::String,
          default: serde_json::json!("Ferrum Dark"),
          description: "Color theme".to_string(),
          enum_values: Some(vec!["Ferrum Dark".to_string(), "Ferrum Light".to_string()]),
          minimum: None,
          maximum: None,
        },
      ],
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_builtin_schema() {
    let schema = SettingsSchema::builtin();

    assert_eq!(schema.version, "1.0");
    assert!(!schema.settings.is_empty());
  }

  #[test]
  fn test_font_size_setting() {
    let schema = SettingsSchema::builtin();
    let font_size = schema.settings.iter().find(|s| s.key == "editor.fontSize");

    assert!(font_size.is_some());
    let setting = font_size.unwrap();
    assert!(matches!(setting.r#type, SettingType::Number));
    assert_eq!(setting.default, serde_json::json!(14.0));
    assert_eq!(setting.minimum, Some(8.0));
    assert_eq!(setting.maximum, Some(72.0));
  }

  #[test]
  fn test_tab_size_setting() {
    let schema = SettingsSchema::builtin();
    let tab_size = schema.settings.iter().find(|s| s.key == "editor.tabSize");

    assert!(tab_size.is_some());
    let setting = tab_size.unwrap();
    assert_eq!(setting.default, serde_json::json!(4));
  }

  #[test]
  fn test_theme_setting_with_enum() {
    let schema = SettingsSchema::builtin();
    let theme = schema.settings.iter().find(|s| s.key == "ui.theme");

    assert!(theme.is_some());
    let setting = theme.unwrap();
    assert!(setting.enum_values.is_some());
    let values = setting.enum_values.as_ref().unwrap();
    assert!(values.contains(&"Ferrum Dark".to_string()));
    assert!(values.contains(&"Ferrum Light".to_string()));
  }

  #[test]
  fn test_setting_serialization() {
    let setting = SettingDefinition {
      key: "test.setting".to_string(),
      r#type: SettingType::Boolean,
      default: serde_json::json!(true),
      description: "A test setting".to_string(),
      enum_values: None,
      minimum: None,
      maximum: None,
    };

    let json = serde_json::to_string(&setting).unwrap();
    let deserialized: SettingDefinition = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.key, "test.setting");
    assert_eq!(deserialized.default, serde_json::json!(true));
  }

  #[test]
  fn test_schema_serialization() {
    let schema = SettingsSchema::builtin();

    let json = serde_json::to_string(&schema).unwrap();
    let deserialized: SettingsSchema = serde_json::from_str(&json).unwrap();

    assert_eq!(deserialized.version, schema.version);
    assert_eq!(deserialized.settings.len(), schema.settings.len());
  }
}
