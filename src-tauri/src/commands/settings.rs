//! Settings commands

use crate::state::AppState;
use ferrum_settings::Settings;
use serde_json::Value;
use tauri::State;

/// Get all settings
#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Settings {
  state.settings.read().clone()
}

/// Update settings
#[tauri::command]
pub fn update_settings(state: State<'_, AppState>, updates: Value) -> Settings {
  let mut settings = state.settings.write();
  settings.merge(updates);
  settings.clone()
}
