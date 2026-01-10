//! Project operation commands

use crate::state::AppState;
use ferrum_core::prelude::*;
use ferrum_fs::walker::FileWalker;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{Emitter, State, Window};

/// Project info response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub path: String,
    pub name: String,
    pub file_count: usize,
    pub has_git: bool,
}

/// File tree node
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub is_hidden: bool,
    pub children: Option<Vec<FileTreeNode>>,
    pub depth: usize,
}

/// Open a project directory
#[tauri::command]
pub async fn open_project(
    state: State<'_, AppState>,
    path: String,
) -> Result<ProjectInfo, String> {
    let path_buf = PathBuf::from(&path);

    if !path_buf.exists() {
        return Err("Directory does not exist".to_string());
    }

    if !path_buf.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    let name = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Check for git
    let has_git = path_buf.join(".git").exists();

    // Count files (limited walk for speed)
    let walker = FileWalker::new(&path_buf).max_depth(3);
    let files = walker.walk().map_err(|e| e.to_string())?;
    let file_count = files.len();

    // Update file searcher with new root
    {
        let mut searcher = state.file_searcher.write();
        searcher.set_root(&path_buf);
    }

    // Set project in editor state
    state
        .editor
        .set_project_root(path_buf.clone())
        .map_err(|e| e.to_string())?;

    Ok(ProjectInfo {
        path,
        name,
        file_count,
        has_git,
    })
}

/// Get file tree for a directory
#[tauri::command]
pub async fn get_file_tree(
    path: String,
    max_depth: Option<usize>,
) -> Result<Vec<FileTreeNode>, String> {
    let path_buf = PathBuf::from(&path);
    build_file_tree(&path_buf, 0, max_depth.unwrap_or(2)).await
}

/// Build file tree recursively
async fn build_file_tree(
    path: &PathBuf,
    depth: usize,
    max_depth: usize,
) -> Result<Vec<FileTreeNode>, String> {
    let mut entries = Vec::new();

    let mut dir = tokio::fs::read_dir(path)
        .await
        .map_err(|e| format!("Cannot read directory: {}", e))?;

    while let Some(entry) = dir.next_entry().await.map_err(|e| e.to_string())? {
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Skip common ignored directories
        if file_name == "node_modules"
            || file_name == "target"
            || file_name == ".git"
            || file_name == "dist"
            || file_name == "build"
        {
            continue;
        }

        let file_type = entry.file_type().await.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        let is_dir = file_type.is_dir();
        let is_hidden = file_name.starts_with('.');

        let children = if is_dir && depth < max_depth {
            Some(Box::pin(build_file_tree(&entry_path, depth + 1, max_depth)).await?)
        } else if is_dir {
            Some(Vec::new()) // Has children but not loaded
        } else {
            None
        };

        entries.push(FileTreeNode {
            name: file_name,
            path: entry_path.to_string_lossy().to_string(),
            is_dir,
            is_hidden,
            children,
            depth,
        });
    }

    // Sort: directories first, then files, both alphabetically
    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

/// Expand a directory in the file tree (lazy loading)
#[tauri::command]
pub async fn expand_directory(path: String) -> Result<Vec<FileTreeNode>, String> {
    let path_buf = PathBuf::from(&path);
    build_file_tree(&path_buf, 0, 1).await
}

/// Watch a directory for changes
#[tauri::command]
pub async fn watch_directory(
    state: State<'_, AppState>,
    window: Window,
    path: String,
) -> Result<(), String> {
    // File watching will be handled by ferrum_fs::watcher
    // For now, emit an event when called
    window
        .emit("fs:watch_started", &path)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get recent projects
#[tauri::command]
pub fn get_recent_projects(state: State<'_, AppState>) -> Vec<ProjectInfo> {
    // TODO: Load from settings/persistence
    Vec::new()
}
