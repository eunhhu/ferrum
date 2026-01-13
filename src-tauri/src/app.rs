//! Tauri application setup

use tauri::Manager;
use tracing::info;

use crate::commands;
use crate::commands::terminal::TerminalManager;
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

            // Terminal manager
            let terminal_manager = TerminalManager::new();
            app.manage(terminal_manager);

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
            commands::buffer::buffer_save,
            commands::buffer::buffer_save_as,
            commands::buffer::open_file_buffer,
            // Project operations
            commands::project::open_project,
            commands::project::get_file_tree,
            commands::project::expand_directory,
            commands::project::watch_directory,
            commands::project::unwatch_directory,
            commands::project::get_recent_projects,
            // Search operations
            commands::search::search_files,
            commands::search::search_text,
            // Syntax highlighting
            commands::syntax::get_highlights,
            commands::syntax::detect_language,
            commands::syntax::get_supported_languages,
            commands::syntax::expand_selection,
            commands::syntax::shrink_selection,
            // Settings
            commands::settings::get_settings,
            commands::settings::update_settings,
            // LSP
            commands::lsp::lsp_start,
            commands::lsp::lsp_stop,
            commands::lsp::lsp_status,
            commands::lsp::lsp_completion,
            commands::lsp::lsp_hover,
            commands::lsp::lsp_goto_definition,
            commands::lsp::lsp_references,
            commands::lsp::lsp_document_symbols,
            commands::lsp::lsp_diagnostics,
            commands::lsp::lsp_did_open,
            commands::lsp::lsp_did_change,
            commands::lsp::lsp_did_save,
            commands::lsp::lsp_did_close,
            // Terminal
            commands::terminal::terminal_create,
            commands::terminal::terminal_write,
            commands::terminal::terminal_resize,
            commands::terminal::terminal_kill,
            commands::terminal::terminal_info,
            commands::terminal::terminal_list,
            // Git
            commands::git::git_status,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_stage_all,
            commands::git::git_commit,
            commands::git::git_log,
            commands::git::git_branches,
            commands::git::git_checkout,
            commands::git::git_discard,
            commands::git::git_discard,
            commands::git::git_diff_file,
            // View
            commands::view::get_depth_map,
            commands::view::get_depth_regions,
            commands::view::get_fold_state,
            commands::view::toggle_fold,
        ])
}
