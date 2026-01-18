//! Plugin API definitions
//!
//! Defines the API surface available to plugins.

use crate::permission::PluginId;
use serde::{Deserialize, Serialize};

/// Result type for plugin API calls
pub type ApiResult<T> = Result<T, ApiError>;

/// Plugin API error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiError {
  pub code: String,
  pub message: String,
}

impl ApiError {
  pub fn permission_denied(permission: &str) -> Self {
    Self {
      code: "PERMISSION_DENIED".to_string(),
      message: format!("Permission '{}' is required for this operation", permission),
    }
  }

  pub fn not_found(resource: &str) -> Self {
    Self {
      code: "NOT_FOUND".to_string(),
      message: format!("{} not found", resource),
    }
  }

  pub fn invalid_argument(message: impl Into<String>) -> Self {
    Self {
      code: "INVALID_ARGUMENT".to_string(),
      message: message.into(),
    }
  }

  pub fn internal(message: impl Into<String>) -> Self {
    Self {
      code: "INTERNAL_ERROR".to_string(),
      message: message.into(),
    }
  }
}

/// Position in a document
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Position {
  pub line: u32,
  pub character: u32,
}

/// Range in a document
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Range {
  pub start: Position,
  pub end: Position,
}

/// Selection in an editor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Selection {
  pub anchor: Position,
  pub active: Position,
}

/// Editor information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorInfo {
  pub id: String,
  pub file_path: Option<String>,
  pub language_id: Option<String>,
  pub is_dirty: bool,
}

/// Diagnostic severity
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

/// Diagnostic message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
  pub range: Range,
  pub severity: DiagnosticSeverity,
  pub message: String,
  pub source: Option<String>,
  pub code: Option<String>,
}

/// Plugin API interface
///
/// This trait defines all the APIs available to plugins.
/// Each method corresponds to a function that can be called from plugin code.
pub trait PluginApi: Send + Sync {
  // ========== Workspace API ==========

  /// Get the workspace root path
  fn workspace_root(&self, plugin_id: PluginId) -> ApiResult<Option<String>>;

  /// Get all open files
  fn workspace_get_open_files(&self, plugin_id: PluginId) -> ApiResult<Vec<String>>;

  /// Open a file in the editor
  fn workspace_open_file(&self, plugin_id: PluginId, path: &str) -> ApiResult<EditorInfo>;

  // ========== Editor API ==========

  /// Get the active editor
  fn editor_get_active(&self, plugin_id: PluginId) -> ApiResult<Option<EditorInfo>>;

  /// Get editor text content
  fn editor_get_text(&self, plugin_id: PluginId, editor_id: &str) -> ApiResult<String>;

  /// Get editor text in a range
  fn editor_get_text_in_range(
    &self,
    plugin_id: PluginId,
    editor_id: &str,
    range: Range,
  ) -> ApiResult<String>;

  /// Insert text at a position
  fn editor_insert_text(
    &self,
    plugin_id: PluginId,
    editor_id: &str,
    position: Position,
    text: &str,
  ) -> ApiResult<()>;

  /// Replace text in a range
  fn editor_replace_range(
    &self,
    plugin_id: PluginId,
    editor_id: &str,
    range: Range,
    text: &str,
  ) -> ApiResult<()>;

  /// Get current selections
  fn editor_get_selections(
    &self,
    plugin_id: PluginId,
    editor_id: &str,
  ) -> ApiResult<Vec<Selection>>;

  /// Set selections
  fn editor_set_selections(
    &self,
    plugin_id: PluginId,
    editor_id: &str,
    selections: Vec<Selection>,
  ) -> ApiResult<()>;

  // ========== FileSystem API ==========

  /// Read a file
  fn fs_read_file(&self, plugin_id: PluginId, path: &str) -> ApiResult<String>;

  /// Write a file
  fn fs_write_file(&self, plugin_id: PluginId, path: &str, content: &str) -> ApiResult<()>;

  /// Check if a path exists
  fn fs_exists(&self, plugin_id: PluginId, path: &str) -> ApiResult<bool>;

  /// List directory contents
  fn fs_read_dir(&self, plugin_id: PluginId, path: &str) -> ApiResult<Vec<String>>;

  // ========== Diagnostics API ==========

  /// Add diagnostics for a file
  fn diagnostics_set(
    &self,
    plugin_id: PluginId,
    file_path: &str,
    diagnostics: Vec<Diagnostic>,
  ) -> ApiResult<()>;

  /// Clear diagnostics for a file
  fn diagnostics_clear(&self, plugin_id: PluginId, file_path: &str) -> ApiResult<()>;

  // ========== UI API ==========

  /// Show an information message
  fn ui_show_message(&self, plugin_id: PluginId, message: &str) -> ApiResult<()>;

  /// Show an error message
  fn ui_show_error(&self, plugin_id: PluginId, message: &str) -> ApiResult<()>;

  /// Show a quick pick menu
  fn ui_show_quick_pick(
    &self,
    plugin_id: PluginId,
    items: Vec<String>,
    placeholder: Option<&str>,
  ) -> ApiResult<Option<String>>;

  /// Show an input box
  fn ui_show_input_box(
    &self,
    plugin_id: PluginId,
    prompt: Option<&str>,
    placeholder: Option<&str>,
    value: Option<&str>,
  ) -> ApiResult<Option<String>>;

  // ========== Debug API ==========

  /// Log a debug message
  fn debug_log(&self, plugin_id: PluginId, message: &str);

  /// Log a warning message
  fn debug_warn(&self, plugin_id: PluginId, message: &str);

  /// Log an error message
  fn debug_error(&self, plugin_id: PluginId, message: &str);
}

/// Placeholder implementation for testing
pub struct MockPluginApi;

impl PluginApi for MockPluginApi {
  fn workspace_root(&self, _plugin_id: PluginId) -> ApiResult<Option<String>> {
    Ok(None)
  }

  fn workspace_get_open_files(&self, _plugin_id: PluginId) -> ApiResult<Vec<String>> {
    Ok(vec![])
  }

  fn workspace_open_file(&self, _plugin_id: PluginId, _path: &str) -> ApiResult<EditorInfo> {
    Err(ApiError::not_found("File"))
  }

  fn editor_get_active(&self, _plugin_id: PluginId) -> ApiResult<Option<EditorInfo>> {
    Ok(None)
  }

  fn editor_get_text(&self, _plugin_id: PluginId, _editor_id: &str) -> ApiResult<String> {
    Ok(String::new())
  }

  fn editor_get_text_in_range(
    &self,
    _plugin_id: PluginId,
    _editor_id: &str,
    _range: Range,
  ) -> ApiResult<String> {
    Ok(String::new())
  }

  fn editor_insert_text(
    &self,
    _plugin_id: PluginId,
    _editor_id: &str,
    _position: Position,
    _text: &str,
  ) -> ApiResult<()> {
    Ok(())
  }

  fn editor_replace_range(
    &self,
    _plugin_id: PluginId,
    _editor_id: &str,
    _range: Range,
    _text: &str,
  ) -> ApiResult<()> {
    Ok(())
  }

  fn editor_get_selections(
    &self,
    _plugin_id: PluginId,
    _editor_id: &str,
  ) -> ApiResult<Vec<Selection>> {
    Ok(vec![])
  }

  fn editor_set_selections(
    &self,
    _plugin_id: PluginId,
    _editor_id: &str,
    _selections: Vec<Selection>,
  ) -> ApiResult<()> {
    Ok(())
  }

  fn fs_read_file(&self, _plugin_id: PluginId, _path: &str) -> ApiResult<String> {
    Err(ApiError::not_found("File"))
  }

  fn fs_write_file(&self, _plugin_id: PluginId, _path: &str, _content: &str) -> ApiResult<()> {
    Ok(())
  }

  fn fs_exists(&self, _plugin_id: PluginId, _path: &str) -> ApiResult<bool> {
    Ok(false)
  }

  fn fs_read_dir(&self, _plugin_id: PluginId, _path: &str) -> ApiResult<Vec<String>> {
    Ok(vec![])
  }

  fn diagnostics_set(
    &self,
    _plugin_id: PluginId,
    _file_path: &str,
    _diagnostics: Vec<Diagnostic>,
  ) -> ApiResult<()> {
    Ok(())
  }

  fn diagnostics_clear(&self, _plugin_id: PluginId, _file_path: &str) -> ApiResult<()> {
    Ok(())
  }

  fn ui_show_message(&self, _plugin_id: PluginId, _message: &str) -> ApiResult<()> {
    Ok(())
  }

  fn ui_show_error(&self, _plugin_id: PluginId, _message: &str) -> ApiResult<()> {
    Ok(())
  }

  fn ui_show_quick_pick(
    &self,
    _plugin_id: PluginId,
    _items: Vec<String>,
    _placeholder: Option<&str>,
  ) -> ApiResult<Option<String>> {
    Ok(None)
  }

  fn ui_show_input_box(
    &self,
    _plugin_id: PluginId,
    _prompt: Option<&str>,
    _placeholder: Option<&str>,
    _value: Option<&str>,
  ) -> ApiResult<Option<String>> {
    Ok(None)
  }

  fn debug_log(&self, plugin_id: PluginId, message: &str) {
    tracing::debug!(plugin_id = %plugin_id, "{}", message);
  }

  fn debug_warn(&self, plugin_id: PluginId, message: &str) {
    tracing::warn!(plugin_id = %plugin_id, "{}", message);
  }

  fn debug_error(&self, plugin_id: PluginId, message: &str) {
    tracing::error!(plugin_id = %plugin_id, "{}", message);
  }
}
