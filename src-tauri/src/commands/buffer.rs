//! Buffer operation commands

use crate::state::AppState;
use ferrum_core::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct BufferInfo {
    pub id: String,
    pub content: String,
    pub version: u64,
    pub is_dirty: bool,
    pub language: Option<String>,
}

/// Create a new buffer
#[tauri::command]
pub fn create_buffer(
    state: State<'_, AppState>,
    content: Option<String>,
) -> Result<BufferInfo, String> {
    let buffer = match content {
        Some(c) => state.editor.create_buffer_with_content(&c),
        None => state.editor.create_buffer(),
    };

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content: buffer.to_string(),
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}

/// Insert text into a buffer
#[tauri::command]
pub fn buffer_insert(
    state: State<'_, AppState>,
    buffer_id: String,
    position: usize,
    text: String,
) -> Result<BufferInfo, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    buffer
        .insert(position, &text)
        .map_err(|e| e.to_string())?;

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content: buffer.to_string(),
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}

/// Delete text from a buffer
#[tauri::command]
pub fn buffer_delete(
    state: State<'_, AppState>,
    buffer_id: String,
    start: usize,
    end: usize,
) -> Result<BufferInfo, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    buffer.delete(start, end).map_err(|e| e.to_string())?;

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content: buffer.to_string(),
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}

/// Get buffer content
#[tauri::command]
pub fn buffer_content(
    state: State<'_, AppState>,
    buffer_id: String,
) -> Result<BufferInfo, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content: buffer.to_string(),
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}

/// Undo the last edit
#[tauri::command]
pub fn buffer_undo(
    state: State<'_, AppState>,
    buffer_id: String,
) -> Result<BufferInfo, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    buffer.undo();

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content: buffer.to_string(),
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}

/// Redo the last undone edit
#[tauri::command]
pub fn buffer_redo(
    state: State<'_, AppState>,
    buffer_id: String,
) -> Result<BufferInfo, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    buffer.redo();

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content: buffer.to_string(),
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}

/// Replace text in a range
#[tauri::command]
pub fn buffer_replace(
    state: State<'_, AppState>,
    buffer_id: String,
    start: usize,
    end: usize,
    text: String,
) -> Result<BufferInfo, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    buffer.replace(start, end, &text).map_err(|e| e.to_string())?;

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content: buffer.to_string(),
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}

/// Get a specific line from the buffer
#[tauri::command]
pub fn buffer_get_line(
    state: State<'_, AppState>,
    buffer_id: String,
    line: usize,
) -> Result<Option<String>, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    Ok(buffer.line(line))
}

/// Get buffer metrics (line count, character count)
#[tauri::command]
pub fn buffer_metrics(
    state: State<'_, AppState>,
    buffer_id: String,
) -> Result<BufferMetrics, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    Ok(BufferMetrics {
        line_count: buffer.len_lines(),
        char_count: buffer.len_chars(),
        is_dirty: buffer.is_dirty(),
        version: buffer.version(),
    })
}

/// Buffer metrics response
#[derive(Debug, Serialize, Deserialize)]
pub struct BufferMetrics {
    pub line_count: usize,
    pub char_count: usize,
    pub is_dirty: bool,
    pub version: u64,
}

/// Save buffer to file
#[tauri::command]
pub async fn buffer_save(
    state: State<'_, AppState>,
    buffer_id: String,
) -> Result<BufferInfo, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    let path = buffer
        .file_path()
        .ok_or_else(|| "Buffer has no file path".to_string())?;

    let content = buffer.to_string();
    tokio::fs::write(&path, &content)
        .await
        .map_err(|e| format!("Failed to save file: {}", e))?;

    buffer.mark_saved();

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content,
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}

/// Save buffer to a new file path
#[tauri::command]
pub async fn buffer_save_as(
    state: State<'_, AppState>,
    buffer_id: String,
    path: String,
) -> Result<BufferInfo, String> {
    let id: BufferId = buffer_id
        .parse()
        .map_err(|_| "Invalid buffer ID".to_string())?;

    let buffer = state
        .editor
        .buffer(id)
        .ok_or_else(|| "Buffer not found".to_string())?;

    let content = buffer.to_string();
    tokio::fs::write(&path, &content)
        .await
        .map_err(|e| format!("Failed to save file: {}", e))?;

    buffer.set_file_path(&path);
    buffer.mark_saved();

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content,
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}

/// Open a file and create a buffer for it
#[tauri::command]
pub async fn open_file_buffer(
    state: State<'_, AppState>,
    path: String,
) -> Result<BufferInfo, String> {
    let content = tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let buffer = state.editor.open_file(&path, &content);

    Ok(BufferInfo {
        id: buffer.id().to_string(),
        content: buffer.to_string(),
        version: buffer.version(),
        is_dirty: buffer.is_dirty(),
        language: buffer.language_id(),
    })
}
