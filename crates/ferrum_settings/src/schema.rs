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
