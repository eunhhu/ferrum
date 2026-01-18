//! Syntax highlighting commands

use crate::state::AppState;
use ferrum_buffer::syntax::{Highlight, LanguageId, SyntaxError};
use ferrum_core::prelude::*;
use serde::{Deserialize, Serialize};
use tauri::State;

/// Syntax highlight span for frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct HighlightSpan {
  pub start: usize,
  pub end: usize,
  pub kind: String,
  pub css_class: String,
}

/// Parse result for frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct ParseResultResponse {
  pub highlights: Vec<HighlightSpan>,
  pub errors: Vec<SyntaxErrorResponse>,
  pub parse_time_us: u64,
}

/// Syntax error for frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct SyntaxErrorResponse {
  pub start: usize,
  pub end: usize,
  pub start_line: usize,
  pub start_column: usize,
  pub end_line: usize,
  pub end_column: usize,
  pub message: String,
}

impl From<Highlight> for HighlightSpan {
  fn from(h: Highlight) -> Self {
    Self {
      start: h.start,
      end: h.end,
      kind: format!("{:?}", h.kind),
      css_class: h.kind.css_class().to_string(),
    }
  }
}

impl From<SyntaxError> for SyntaxErrorResponse {
  fn from(e: SyntaxError) -> Self {
    Self {
      start: e.start,
      end: e.end,
      start_line: e.start_point.0,
      start_column: e.start_point.1,
      end_line: e.end_point.0,
      end_column: e.end_point.1,
      message: e.message,
    }
  }
}

/// Get syntax highlights for a buffer
#[tauri::command]
pub fn get_highlights(
  state: State<'_, AppState>,
  buffer_id: String,
  start_byte: Option<usize>,
  end_byte: Option<usize>,
) -> Result<ParseResultResponse, String> {
  let id: BufferId = buffer_id
    .parse()
    .map_err(|_| "Invalid buffer ID".to_string())?;

  let buffer = state
    .editor
    .buffer(id)
    .ok_or_else(|| "Buffer not found".to_string())?;

  // Get language from buffer
  let language_str = buffer
    .language_id()
    .unwrap_or_else(|| "unknown".to_string());
  let language = match language_str.as_str() {
    "rust" => LanguageId::Rust,
    "typescript" => LanguageId::TypeScript,
    "javascript" => LanguageId::JavaScript,
    "python" => LanguageId::Python,
    "go" => LanguageId::Go,
    "json" => LanguageId::Json,
    "toml" => LanguageId::Toml,
    "html" => LanguageId::Html,
    "css" => LanguageId::Css,
    "markdown" => LanguageId::Markdown,
    _ => LanguageId::Unknown,
  };

  if language == LanguageId::Unknown {
    return Ok(ParseResultResponse {
      highlights: Vec::new(),
      errors: Vec::new(),
      parse_time_us: 0,
    });
  }

  // Get or create syntax manager for this buffer
  let result = state
    .editor
    .get_syntax_highlights(id, start_byte, end_byte)
    .map_err(|e| e.to_string())?;

  Ok(ParseResultResponse {
    highlights: result.highlights.into_iter().map(Into::into).collect(),
    errors: result.errors.into_iter().map(Into::into).collect(),
    parse_time_us: result.parse_time_us,
  })
}

/// Detect language for a file path
#[tauri::command]
pub fn detect_language(path: String) -> String {
  use std::path::Path;

  Path::new(&path)
    .extension()
    .and_then(|e| e.to_str())
    .map(|ext| {
      let lang = LanguageId::from_extension(ext);
      format!("{:?}", lang).to_lowercase()
    })
    .unwrap_or_else(|| "unknown".to_string())
}

/// Get supported languages
#[tauri::command]
pub fn get_supported_languages() -> Vec<String> {
  vec![
    "rust".to_string(),
    "typescript".to_string(),
    "typescriptreact".to_string(),
    "javascript".to_string(),
    "javascriptreact".to_string(),
    "python".to_string(),
    "go".to_string(),
    "json".to_string(),
    "toml".to_string(),
    "html".to_string(),
    "css".to_string(),
    "markdown".to_string(),
  ]
}

/// Selection range for smart expansion
#[derive(Debug, Serialize, Deserialize)]
pub struct SelectionRange {
  pub start_line: u32,
  pub start_character: u32,
  pub end_line: u32,
  pub end_character: u32,
  pub start_byte: usize,
  pub end_byte: usize,
}

/// Expand selection to the next larger syntax node
#[tauri::command]
pub fn expand_selection(
  state: State<'_, AppState>,
  buffer_id: String,
  start_byte: usize,
  end_byte: usize,
) -> Result<SelectionRange, String> {
  let id: BufferId = buffer_id
    .parse()
    .map_err(|_| "Invalid buffer ID".to_string())?;

  let result = state
    .editor
    .expand_selection(id, start_byte, end_byte)
    .map_err(|e| e.to_string())?;

  Ok(SelectionRange {
    start_line: result.0 as u32,
    start_character: result.1 as u32,
    end_line: result.2 as u32,
    end_character: result.3 as u32,
    start_byte: result.4,
    end_byte: result.5,
  })
}

/// Shrink selection to the next smaller syntax node
#[tauri::command]
pub fn shrink_selection(
  state: State<'_, AppState>,
  buffer_id: String,
  start_byte: usize,
  end_byte: usize,
) -> Result<SelectionRange, String> {
  let id: BufferId = buffer_id
    .parse()
    .map_err(|_| "Invalid buffer ID".to_string())?;

  let result = state
    .editor
    .shrink_selection(id, start_byte, end_byte)
    .map_err(|e| e.to_string())?;

  Ok(SelectionRange {
    start_line: result.0 as u32,
    start_character: result.1 as u32,
    end_line: result.2 as u32,
    end_character: result.3 as u32,
    start_byte: result.4,
    end_byte: result.5,
  })
}

/// Dependency link between two symbols
#[derive(Debug, Serialize, Deserialize)]
pub struct DependencyLink {
  pub id: String,
  pub from_symbol: String,
  pub to_symbol: String,
  pub from_line: u32,
  pub to_line: u32,
  pub from_column: u32,
  pub to_column: u32,
  #[serde(rename = "type")]
  pub link_type: String, // "import", "call", "reference", "extends", "implements"
}

/// Analyze code dependencies in a buffer
#[tauri::command]
pub fn analyze_dependencies(
  state: State<'_, AppState>,
  buffer_id: String,
) -> Result<Vec<DependencyLink>, String> {
  let id: BufferId = buffer_id
    .parse()
    .map_err(|_| "Invalid buffer ID".to_string())?;

  let result = state
    .editor
    .analyze_dependencies(id)
    .map_err(|e| e.to_string())?;

  Ok(
    result
      .into_iter()
      .map(
        |(from_name, from_line, from_col, to_name, to_line, to_col, link_type)| DependencyLink {
          id: format!("{}-{}-{}-{}", from_name, from_line, to_name, to_line),
          from_symbol: from_name,
          to_symbol: to_name,
          from_line,
          to_line,
          from_column: from_col,
          to_column: to_col,
          link_type,
        },
      )
      .collect(),
  )
}
