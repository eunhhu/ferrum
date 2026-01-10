/**
 * IPC types matching the Rust backend
 */

// Response wrapper from backend
export interface IpcSuccess<T> {
  status: "success";
  data: T;
}

export interface IpcError {
  status: "error";
  error: {
    code: string;
    message: string;
    recoverable: boolean;
  };
}

export type IpcResponse<T> = IpcSuccess<T> | IpcError;

// File types
export interface FileContent {
  path: string;
  content: string;
  language: string | null;
}

export interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_hidden: boolean;
}

// Buffer types
export interface BufferInfo {
  id: string;
  content: string;
  version: number;
  is_dirty: boolean;
  language: string | null;
}

// Search types
export interface FileSearchResult {
  path: string;
  score: number;
}

export interface TextSearchResult {
  path: string;
  line: number;
  column: number;
  content: string;
  match_start: number;
  match_end: number;
}

export interface TextSearchOptions {
  case_sensitive?: boolean;
  whole_word?: boolean;
  regex?: boolean;
  max_results?: number;
}

// Settings types
export interface EditorSettings {
  font_family: string;
  font_size: number;
  line_height: number;
  tab_size: number;
  insert_spaces: boolean;
  word_wrap: boolean;
  minimap_enabled: boolean;
  line_numbers: boolean;
  highlight_active_line: boolean;
  bracket_pair_colorization: boolean;
  auto_save: boolean;
  auto_save_delay_ms: number;
  format_on_save: boolean;
}

export interface TerminalSettings {
  shell: string | null;
  font_family: string;
  font_size: number;
  cursor_style: string;
  cursor_blink: boolean;
}

export interface UISettings {
  theme: string;
  sidebar_position: string;
  activity_bar_visible: boolean;
  status_bar_visible: boolean;
  tab_close_button: boolean;
  breadcrumbs_enabled: boolean;
}

export interface Settings {
  editor: EditorSettings;
  terminal: TerminalSettings;
  ui: UISettings;
}

// Buffer metrics
export interface BufferMetrics {
  line_count: number;
  char_count: number;
  is_dirty: boolean;
  version: number;
}

// Project types
export interface ProjectInfo {
  path: string;
  name: string;
  file_count: number;
  has_git: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  is_dir: boolean;
  is_hidden: boolean;
  children: FileTreeNode[] | null;
  depth: number;
}

// Syntax highlighting types
export interface HighlightSpan {
  start: number;
  end: number;
  kind: string;
  css_class: string;
}

export interface SyntaxError {
  start: number;
  end: number;
  start_line: number;
  start_column: number;
  end_line: number;
  end_column: number;
  message: string;
}

export interface ParseResult {
  highlights: HighlightSpan[];
  errors: SyntaxError[];
  parse_time_us: number;
}

// Display map types
export interface DisplayPoint {
  row: number;
  column: number;
}

export interface Fold {
  start: number;
  end: number;
  placeholder: string;
}

export interface DisplayMapConfig {
  tab_width: number;
  soft_wrap: boolean;
  wrap_width: number | null;
  show_invisibles: boolean;
}

// Note: LSP types are defined in commands.ts to avoid duplication
