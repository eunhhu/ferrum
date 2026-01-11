//! View operation commands (Tree Viewer, etc)

use crate::state::AppState;
use ferrum_core::prelude::*;
use ferrum_editor::depth::DepthRegion;
use ferrum_editor::fold::FoldState;
use std::collections::HashMap;
use tauri::State;

/// Get depth map for a buffer
#[tauri::command]
pub fn get_depth_map(
  state: State<'_, AppState>,
  buffer_id: String,
) -> Result<HashMap<String, u32>, String> {
  let id: BufferId = buffer_id
    .parse()
    .map_err(|_| "Invalid buffer ID".to_string())?;

  // We only need the depth per line/range.
  // The DepthAnalyzer stores HashMap<Range, u32>.
  // Range keys might be hard to serialize as JSON keys if they are objects.
  // We should probably convert to a list of regions or a simplified map.

  // Actually, DepthAnalyzer implementation uses HashMap<Range, u32>.
  // JSON keys must be strings.
  // Let's return a list of DepthRegion instead, or simplify for frontend.
  // The frontend tree viewer needs depth per line.

  // Let's iterate and build a line -> depth map for simplicity on frontend?
  // Or return all regions.

  let depth_map = state
    .editor
    .get_depth_map(id)
    .ok_or_else(|| "Buffer not found".to_string())?;

  // Convert Range key to string "start_line:col-end_line:col" or just return list of objects
  // But wait, the return type I defined is HashMap<String, u32>.
  // A list of regions is better.
  // Let's change return type.

  let mut regions = Vec::new();
  for (range, depth) in depth_map {
    regions.push(DepthRegionInfo {
      start_line: range.start.line(),
      end_line: range.end.line(),
      depth,
    });
  }

  // Quick hack: Serialize manually to JSON string or change struct?
  // Let's define a DTO here.
  Ok(
    regions
      .into_iter()
      .map(|r| (format!("{}-{}", r.start_line, r.end_line), r.depth))
      .collect(),
  )
}

#[derive(serde::Serialize)]
pub struct DepthRegionInfo {
  pub start_line: usize,
  pub end_line: usize,
  pub depth: u32,
}

/// Get simplified depth info (list of regions)
#[tauri::command]
pub fn get_depth_regions(
  state: State<'_, AppState>,
  buffer_id: String,
) -> Result<Vec<DepthRegionInfo>, String> {
  let id: BufferId = buffer_id
    .parse()
    .map_err(|_| "Invalid buffer ID".to_string())?;

  let depth_map = state
    .editor
    .get_depth_map(id)
    .ok_or_else(|| "Buffer not found".to_string())?;

  Ok(
    depth_map
      .into_iter()
      .map(|(range, depth)| DepthRegionInfo {
        start_line: range.start.line(),
        end_line: range.end.line(),
        depth,
      })
      .collect(),
  )
}

/// Get fold state
#[tauri::command]
pub fn get_fold_state(state: State<'_, AppState>, buffer_id: String) -> Result<FoldState, String> {
  let id: BufferId = buffer_id
    .parse()
    .map_err(|_| "Invalid buffer ID".to_string())?;

  state
    .editor
    .get_fold_state(id)
    .ok_or_else(|| "Buffer not found".to_string())
}

/// Toggle fold
#[tauri::command]
pub fn toggle_fold(
  state: State<'_, AppState>,
  buffer_id: String,
  line: usize,
) -> Result<bool, String> {
  let id: BufferId = buffer_id
    .parse()
    .map_err(|_| "Invalid buffer ID".to_string())?;

  state
    .editor
    .toggle_fold(id, line)
    .map_err(|e| e.to_string())
}
