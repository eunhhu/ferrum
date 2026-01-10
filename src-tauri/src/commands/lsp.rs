//! LSP-related Tauri commands

use crate::state::AppState;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Position in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub line: u32,
    pub character: u32,
}

/// Range in a document
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Range {
    pub start: Position,
    pub end: Position,
}

/// Location (file + range)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub uri: String,
    pub range: Range,
}

/// Completion item
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionItem {
    pub label: String,
    pub kind: u32,
    pub detail: Option<String>,
    pub documentation: Option<String>,
    pub insert_text: Option<String>,
    pub sort_text: Option<String>,
}

/// Hover result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HoverResult {
    pub contents: String,
    pub range: Option<Range>,
}

/// Diagnostic severity
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[repr(u8)]
pub enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4,
}

/// Diagnostic
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Diagnostic {
    pub range: Range,
    pub severity: u8,
    pub code: Option<String>,
    pub source: Option<String>,
    pub message: String,
}

/// Symbol information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymbolInfo {
    pub name: String,
    pub kind: u32,
    pub range: Range,
    pub selection_range: Range,
    pub children: Option<Vec<SymbolInfo>>,
}

/// LSP server status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LspStatus {
    pub language: String,
    pub running: bool,
    pub initialized: bool,
}

/// Start an LSP server for a language
#[tauri::command]
pub async fn lsp_start(
    _state: State<'_, AppState>,
    language: String,
    _root_path: String,
) -> Result<LspStatus, String> {
    // TODO: Actually start the LSP server based on language
    // For now, return a placeholder status
    Ok(LspStatus {
        language,
        running: false,
        initialized: false,
    })
}

/// Stop an LSP server
#[tauri::command]
pub async fn lsp_stop(
    _state: State<'_, AppState>,
    language: String,
) -> Result<(), String> {
    // TODO: Stop the LSP server
    let _ = language;
    Ok(())
}

/// Get LSP server status
#[tauri::command]
pub fn lsp_status(
    _state: State<'_, AppState>,
    language: String,
) -> LspStatus {
    // TODO: Get actual status from LspManager
    LspStatus {
        language,
        running: false,
        initialized: false,
    }
}

/// Request completions at a position
#[tauri::command]
pub async fn lsp_completion(
    _state: State<'_, AppState>,
    _file_path: String,
    _line: u32,
    _character: u32,
) -> Result<Vec<CompletionItem>, String> {
    // TODO: Forward to LSP client
    // For now, return empty list
    Ok(Vec::new())
}

/// Request hover information
#[tauri::command]
pub async fn lsp_hover(
    _state: State<'_, AppState>,
    _file_path: String,
    _line: u32,
    _character: u32,
) -> Result<Option<HoverResult>, String> {
    // TODO: Forward to LSP client
    Ok(None)
}

/// Go to definition
#[tauri::command]
pub async fn lsp_goto_definition(
    _state: State<'_, AppState>,
    _file_path: String,
    _line: u32,
    _character: u32,
) -> Result<Vec<Location>, String> {
    // TODO: Forward to LSP client
    Ok(Vec::new())
}

/// Find references
#[tauri::command]
pub async fn lsp_references(
    _state: State<'_, AppState>,
    _file_path: String,
    _line: u32,
    _character: u32,
    _include_declaration: bool,
) -> Result<Vec<Location>, String> {
    // TODO: Forward to LSP client
    Ok(Vec::new())
}

/// Get document symbols
#[tauri::command]
pub async fn lsp_document_symbols(
    _state: State<'_, AppState>,
    _file_path: String,
) -> Result<Vec<SymbolInfo>, String> {
    // TODO: Forward to LSP client
    Ok(Vec::new())
}

/// Get diagnostics for a file
#[tauri::command]
pub fn lsp_diagnostics(
    _state: State<'_, AppState>,
    _file_path: String,
) -> Vec<Diagnostic> {
    // TODO: Return cached diagnostics
    Vec::new()
}

/// Notify LSP that a file was opened
#[tauri::command]
pub async fn lsp_did_open(
    _state: State<'_, AppState>,
    _file_path: String,
    _language_id: String,
    _version: i32,
    _content: String,
) -> Result<(), String> {
    // TODO: Forward to LSP client
    Ok(())
}

/// Notify LSP that a file was changed
#[tauri::command]
pub async fn lsp_did_change(
    _state: State<'_, AppState>,
    _file_path: String,
    _version: i32,
    _content: String,
) -> Result<(), String> {
    // TODO: Forward to LSP client
    Ok(())
}

/// Notify LSP that a file was saved
#[tauri::command]
pub async fn lsp_did_save(
    _state: State<'_, AppState>,
    _file_path: String,
) -> Result<(), String> {
    // TODO: Forward to LSP client
    Ok(())
}

/// Notify LSP that a file was closed
#[tauri::command]
pub async fn lsp_did_close(
    _state: State<'_, AppState>,
    _file_path: String,
) -> Result<(), String> {
    // TODO: Forward to LSP client
    Ok(())
}
