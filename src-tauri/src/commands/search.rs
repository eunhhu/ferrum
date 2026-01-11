//! Search commands

use crate::state::AppState;
use ferrum_search::{SearchOptions, TextSearcher};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSearchResult {
  pub path: String,
  pub score: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TextSearchResult {
  pub path: String,
  pub line: usize,
  pub column: usize,
  pub content: String,
  pub match_start: usize,
  pub match_end: usize,
}

#[derive(Debug, Deserialize)]
pub struct TextSearchOptions {
  pub case_sensitive: Option<bool>,
  pub whole_word: Option<bool>,
  pub regex: Option<bool>,
  pub max_results: Option<usize>,
}

/// Search for files by name
#[tauri::command]
pub fn search_files(
  state: State<'_, AppState>,
  query: String,
  limit: Option<usize>,
) -> Vec<FileSearchResult> {
  state
    .file_searcher
    .write()
    .search(&query, limit.unwrap_or(50))
    .into_iter()
    .map(|m| FileSearchResult {
      path: m.path.to_string_lossy().to_string(),
      score: m.score,
    })
    .collect()
}

/// Search for text in files
#[tauri::command]
pub fn search_text(
  root: String,
  query: String,
  options: Option<TextSearchOptions>,
) -> Result<Vec<TextSearchResult>, String> {
  let searcher = TextSearcher::new(&root);
  let opts = options
    .map(|o| SearchOptions {
      case_sensitive: o.case_sensitive.unwrap_or(false),
      whole_word: o.whole_word.unwrap_or(false),
      regex: o.regex.unwrap_or(false),
      max_results: o.max_results,
    })
    .unwrap_or_default();

  let matches = searcher.search(&query, &opts).map_err(|e| e.to_string())?;

  Ok(
    matches
      .into_iter()
      .map(|m| TextSearchResult {
        path: m.path.to_string_lossy().to_string(),
        line: m.line_number,
        column: m.column,
        content: m.line_content,
        match_start: m.match_start,
        match_end: m.match_end,
      })
      .collect(),
  )
}
