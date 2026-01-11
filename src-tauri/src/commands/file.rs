//! File operation commands

use ferrum_core::prelude::*;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileContent {
  pub path: String,
  pub content: String,
  pub language: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DirectoryEntry {
  pub name: String,
  pub path: String,
  pub is_dir: bool,
  pub is_hidden: bool,
}

/// Read a file's content
#[tauri::command]
pub async fn read_file(path: String) -> Result<FileContent, String> {
  let path_buf = PathBuf::from(&path);
  let content = tokio::fs::read_to_string(&path_buf)
    .await
    .map_err(|e| format!("Failed to read file: {}", e))?;

  let language = path_buf
    .extension()
    .and_then(|e| e.to_str())
    .map(detect_language);

  Ok(FileContent {
    path,
    content,
    language,
  })
}

/// Write content to a file
#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
  tokio::fs::write(&path, &content)
    .await
    .map_err(|e| format!("Failed to write file: {}", e))?;
  Ok(())
}

/// List directory contents
#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<DirectoryEntry>, String> {
  let mut entries = Vec::new();
  let mut dir = tokio::fs::read_dir(&path)
    .await
    .map_err(|e| format!("Cannot read directory: {}", e))?;

  while let Some(entry) = dir.next_entry().await.map_err(|e| e.to_string())? {
    let file_name = entry.file_name().to_string_lossy().to_string();
    let file_type = entry.file_type().await.map_err(|e| e.to_string())?;

    entries.push(DirectoryEntry {
      name: file_name.clone(),
      path: entry.path().to_string_lossy().to_string(),
      is_dir: file_type.is_dir(),
      is_hidden: file_name.starts_with('.'),
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

/// Detect language from file extension
fn detect_language(ext: &str) -> String {
  match ext {
    "rs" => "rust",
    "ts" | "tsx" => "typescript",
    "js" | "jsx" => "javascript",
    "py" => "python",
    "go" => "go",
    "java" => "java",
    "c" | "h" => "c",
    "cpp" | "hpp" | "cc" => "cpp",
    "json" => "json",
    "yaml" | "yml" => "yaml",
    "toml" => "toml",
    "md" => "markdown",
    "html" => "html",
    "css" => "css",
    "scss" | "sass" => "scss",
    _ => ext,
  }
  .to_string()
}
