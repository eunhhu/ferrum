//! Project operation commands

use crate::state::AppState;
use ferrum_core::prelude::*;
use ferrum_fs::walker::FileWalker;
use ferrum_fs::watcher::FsEvent;
use ferrum_fs::FileWatcher;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, Window};

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
pub async fn open_project(state: State<'_, AppState>, path: String) -> Result<ProjectInfo, String> {
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

/// File system event for frontend
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "path")]
pub enum FsEventPayload {
  Created(String),
  Modified(String),
  Deleted(String),
  Renamed { from: String, to: String },
}

impl From<FsEvent> for FsEventPayload {
  fn from(event: FsEvent) -> Self {
    match event {
      FsEvent::Created(path) => FsEventPayload::Created(path.to_string_lossy().to_string()),
      FsEvent::Modified(path) => FsEventPayload::Modified(path.to_string_lossy().to_string()),
      FsEvent::Deleted(path) => FsEventPayload::Deleted(path.to_string_lossy().to_string()),
      FsEvent::Renamed { from, to } => FsEventPayload::Renamed {
        from: from.to_string_lossy().to_string(),
        to: to.to_string_lossy().to_string(),
      },
    }
  }
}

/// Watch a directory for changes
#[tauri::command]
pub async fn watch_directory(
  app: AppHandle,
  state: State<'_, AppState>,
  path: String,
) -> Result<(), String> {
  let watcher_state = state.watcher.clone();
  let mut state_guard = watcher_state.lock().await;

  // Check if already watching this path
  if state_guard.watched_paths.contains(&path) {
    return Ok(());
  }

  // Create watcher if not exists
  if state_guard.watcher.is_none() {
    let watcher = FileWatcher::new().map_err(|e| e.to_string())?;
    state_guard.watcher = Some(watcher);

    // Spawn event handler task
    let app_clone = app.clone();
    let watcher_state_clone = state.watcher.clone();

    tokio::spawn(async move {
      loop {
        let event = {
          let mut guard = watcher_state_clone.lock().await;
          if let Some(ref mut watcher) = guard.watcher {
            watcher.recv().await
          } else {
            break;
          }
        };

        if let Some(event) = event {
          let payload: FsEventPayload = event.into();
          let _ = app_clone.emit("fs:change", payload);
        }
      }
    });
  }

  // Start watching the path
  if let Some(ref mut watcher) = state_guard.watcher {
    watcher.watch(&path).map_err(|e| e.to_string())?;
    state_guard.watched_paths.insert(path.clone());
  }

  let _ = app.emit("fs:watch_started", &path);

  Ok(())
}

/// Stop watching a directory
#[tauri::command]
pub async fn unwatch_directory(state: State<'_, AppState>, path: String) -> Result<(), String> {
  let mut state_guard = state.watcher.lock().await;

  if let Some(ref mut watcher) = state_guard.watcher {
    watcher.unwatch(&path).map_err(|e| e.to_string())?;
    state_guard.watched_paths.remove(&path);
  }

  Ok(())
}

/// Get recent projects
#[tauri::command]
pub fn get_recent_projects(state: State<'_, AppState>) -> Vec<ProjectInfo> {
  // TODO: Load from settings/persistence
  Vec::new()
}
