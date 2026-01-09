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
