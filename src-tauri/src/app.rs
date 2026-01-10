//! Tauri application setup

use tauri::Manager;
use tracing::info;

use crate::commands;
use crate::state::AppState;

/// Build the Tauri application
pub fn build() -> tauri::Builder<tauri::Wry> {
    tauri::Builder::default()
        // Plugins
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        // State
        .setup(|app| {
            let state = AppState::new();
            app.manage(state);

            info!("Application setup complete");
            Ok(())
        })
        // Commands
        .invoke_handler(tauri::generate_handler![
            // File operations
            commands::file::read_file,
            commands::file::write_file,
            commands::file::list_directory,
            // Buffer operations
            commands::buffer::create_buffer,
            commands::buffer::buffer_insert,
            commands::buffer::buffer_delete,
            commands::buffer::buffer_replace,
            commands::buffer::buffer_content,
            commands::buffer::buffer_undo,
            commands::buffer::buffer_redo,
            commands::buffer::buffer_get_line,
            commands::buffer::buffer_metrics,
            // Project operations
            commands::project::open_project,
            commands::project::get_file_tree,
            commands::project::expand_directory,
            commands::project::watch_directory,
            commands::project::get_recent_projects,
            // Search operations
            commands::search::search_files,
            commands::search::search_text,
            // Syntax highlighting
            commands::syntax::get_highlights,
            commands::syntax::detect_language,
            commands::syntax::get_supported_languages,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
        ])
}
