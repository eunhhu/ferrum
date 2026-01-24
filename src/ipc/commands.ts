/**
 * Typed IPC commands for calling the Rust backend
 */

import { invoke } from "@tauri-apps/api/core";
import { isTauriEnvironment } from "./tauri-check";
import type {
  BufferInfo,
  BufferMetrics,
  DepthRegionInfo,
  DirectoryEntry,
  FileContent,
  FileSearchResult,
  FileTreeNode,
  FoldState,
  ParseResult,
  ProjectInfo,
  Settings,
  TextSearchOptions,
  TextSearchResult,
} from "./types";

// File operations
export async function readFile(path: string): Promise<FileContent> {
  return await invoke<FileContent>("read_file", { path });
}

export async function writeFile(path: string, content: string): Promise<void> {
  return await invoke<void>("write_file", { path, content });
}

export async function listDirectory(path: string): Promise<DirectoryEntry[]> {
  return await invoke<DirectoryEntry[]>("list_directory", { path });
}

// Buffer operations
export async function createBuffer(content?: string): Promise<BufferInfo> {
  return await invoke<BufferInfo>("create_buffer", { content });
}

export async function bufferInsert(
  bufferId: string,
  position: number,
  text: string
): Promise<BufferInfo> {
  return await invoke<BufferInfo>("buffer_insert", {
    buffer_id: bufferId,
    position,
    text,
  });
}

export async function bufferDelete(
  bufferId: string,
  start: number,
  end: number
): Promise<BufferInfo> {
  return await invoke<BufferInfo>("buffer_delete", {
    buffer_id: bufferId,
    start,
    end,
  });
}

export async function bufferContent(bufferId: string): Promise<BufferInfo> {
  return await invoke<BufferInfo>("buffer_content", { buffer_id: bufferId });
}

// Search operations
export async function searchFiles(query: string, limit?: number): Promise<FileSearchResult[]> {
  return await invoke<FileSearchResult[]>("search_files", { query, limit });
}

export async function searchText(
  root: string,
  query: string,
  options?: TextSearchOptions
): Promise<TextSearchResult[]> {
  return await invoke<TextSearchResult[]>("search_text", {
    root,
    query,
    options,
  });
}

// Settings operations
export async function getSettings(): Promise<Settings> {
  return await invoke<Settings>("get_settings");
}

export async function updateSettings(updates: Partial<Settings>): Promise<Settings> {
  return await invoke<Settings>("update_settings", { updates });
}

// Buffer additional operations
export async function bufferUndo(bufferId: string): Promise<BufferInfo> {
  return await invoke<BufferInfo>("buffer_undo", { buffer_id: bufferId });
}

export async function bufferRedo(bufferId: string): Promise<BufferInfo> {
  return await invoke<BufferInfo>("buffer_redo", { buffer_id: bufferId });
}

export async function bufferReplace(
  bufferId: string,
  start: number,
  end: number,
  text: string
): Promise<BufferInfo> {
  return await invoke<BufferInfo>("buffer_replace", {
    buffer_id: bufferId,
    start,
    end,
    text,
  });
}

export async function bufferGetLine(bufferId: string, line: number): Promise<string | null> {
  return await invoke<string | null>("buffer_get_line", {
    buffer_id: bufferId,
    line,
  });
}

export async function bufferMetrics(bufferId: string): Promise<BufferMetrics> {
  return await invoke<BufferMetrics>("buffer_metrics", {
    buffer_id: bufferId,
  });
}

export async function bufferSave(bufferId: string): Promise<BufferInfo> {
  return await invoke<BufferInfo>("buffer_save", {
    buffer_id: bufferId,
  });
}

export async function bufferSaveAs(bufferId: string, path: string): Promise<BufferInfo> {
  return await invoke<BufferInfo>("buffer_save_as", {
    buffer_id: bufferId,
    path,
  });
}

export async function openFileBuffer(path: string): Promise<BufferInfo> {
  return await invoke<BufferInfo>("open_file_buffer", { path });
}

// Project operations
export async function openProject(path: string): Promise<ProjectInfo> {
  return await invoke<ProjectInfo>("open_project", { path });
}

export async function getFileTree(path: string, maxDepth?: number): Promise<FileTreeNode[]> {
  return await invoke<FileTreeNode[]>("get_file_tree", {
    path,
    max_depth: maxDepth,
  });
}

export async function expandDirectory(path: string): Promise<FileTreeNode[]> {
  return await invoke<FileTreeNode[]>("expand_directory", { path });
}

export async function watchDirectory(path: string): Promise<void> {
  return await invoke<void>("watch_directory", { path });
}

export async function unwatchDirectory(path: string): Promise<void> {
  return await invoke<void>("unwatch_directory", { path });
}

export async function getRecentProjects(): Promise<ProjectInfo[]> {
  return await invoke<ProjectInfo[]>("get_recent_projects");
}

// Syntax highlighting
export async function getHighlights(
  bufferId: string,
  startByte?: number,
  endByte?: number
): Promise<ParseResult> {
  if (!isTauriEnvironment()) {
    return { highlights: [], errors: [], parse_time_us: 0 };
  }
  return await invoke<ParseResult>("get_highlights", {
    buffer_id: bufferId,
    start_byte: startByte,
    end_byte: endByte,
  });
}

export async function detectLanguage(path: string): Promise<string> {
  return await invoke<string>("detect_language", { path });
}

export async function getSupportedLanguages(): Promise<string[]> {
  return await invoke<string[]>("get_supported_languages");
}

export interface SelectionRange {
  start_line: number;
  start_character: number;
  end_line: number;
  end_character: number;
  start_byte: number;
  end_byte: number;
}

export async function expandSelection(
  bufferId: string,
  startByte: number,
  endByte: number
): Promise<SelectionRange> {
  return await invoke<SelectionRange>("expand_selection", {
    buffer_id: bufferId,
    start_byte: startByte,
    end_byte: endByte,
  });
}

export async function shrinkSelection(
  bufferId: string,
  startByte: number,
  endByte: number
): Promise<SelectionRange> {
  return await invoke<SelectionRange>("shrink_selection", {
    buffer_id: bufferId,
    start_byte: startByte,
    end_byte: endByte,
  });
}

// LSP operations
export interface LspStatus {
  language: string;
  running: boolean;
  initialized: boolean;
}

export interface LspLocation {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LspCompletionItem {
  label: string;
  kind: number;
  detail: string | null;
  documentation: string | null;
  insert_text: string | null;
  sort_text: string | null;
}

export interface LspHoverResult {
  contents: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  } | null;
}

export interface LspSymbolInfo {
  name: string;
  kind: number;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  selection_range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  children: LspSymbolInfo[] | null;
}

export interface LspDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity: number;
  code: string | null;
  source: string | null;
  message: string;
}

export async function lspStart(language: string, rootPath: string): Promise<LspStatus> {
  return await invoke<LspStatus>("lsp_start", {
    language,
    root_path: rootPath,
  });
}

export async function lspStop(language: string): Promise<void> {
  return await invoke<void>("lsp_stop", { language });
}

export async function lspStatus(language: string): Promise<LspStatus> {
  return await invoke<LspStatus>("lsp_status", { language });
}

export async function lspCompletion(
  filePath: string,
  line: number,
  character: number
): Promise<LspCompletionItem[]> {
  return await invoke<LspCompletionItem[]>("lsp_completion", {
    file_path: filePath,
    line,
    character,
  });
}

export async function lspHover(
  filePath: string,
  line: number,
  character: number
): Promise<LspHoverResult | null> {
  return await invoke<LspHoverResult | null>("lsp_hover", {
    file_path: filePath,
    line,
    character,
  });
}

export async function lspGotoDefinition(
  filePath: string,
  line: number,
  character: number
): Promise<LspLocation[]> {
  return await invoke<LspLocation[]>("lsp_goto_definition", {
    file_path: filePath,
    line,
    character,
  });
}

export async function lspReferences(
  filePath: string,
  line: number,
  character: number,
  includeDeclaration = true
): Promise<LspLocation[]> {
  return await invoke<LspLocation[]>("lsp_references", {
    file_path: filePath,
    line,
    character,
    include_declaration: includeDeclaration,
  });
}

export async function lspDocumentSymbols(filePath: string): Promise<LspSymbolInfo[]> {
  return await invoke<LspSymbolInfo[]>("lsp_document_symbols", {
    file_path: filePath,
  });
}

export async function lspDiagnostics(filePath: string): Promise<LspDiagnostic[]> {
  return await invoke<LspDiagnostic[]>("lsp_diagnostics", {
    file_path: filePath,
  });
}

export async function lspDidOpen(
  filePath: string,
  languageId: string,
  version: number,
  content: string
): Promise<void> {
  return await invoke<void>("lsp_did_open", {
    file_path: filePath,
    language_id: languageId,
    version,
    content,
  });
}

export async function lspDidChange(
  filePath: string,
  version: number,
  content: string
): Promise<void> {
  return await invoke<void>("lsp_did_change", {
    file_path: filePath,
    version,
    content,
  });
}

export async function lspDidSave(filePath: string): Promise<void> {
  return await invoke<void>("lsp_did_save", { file_path: filePath });
}

export async function lspDidClose(filePath: string): Promise<void> {
  return await invoke<void>("lsp_did_close", { file_path: filePath });
}

export interface LspTextEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  new_text: string;
}

export async function lspRename(
  filePath: string,
  line: number,
  character: number,
  newName: string
): Promise<LspTextEdit[]> {
  return await invoke<LspTextEdit[]>("lsp_rename", {
    file_path: filePath,
    line,
    character,
    new_name: newName,
  });
}

// Scope info for sticky headers
export interface ScopeInfo {
  scope_name: string;
  scope_type: string;
  start_line: number;
  end_line: number;
  depth: number;
}

export async function getScopes(bufferId: string): Promise<ScopeInfo[]> {
  return await invoke<ScopeInfo[]>("get_scopes", { buffer_id: bufferId });
}

// Terminal operations
export interface TerminalInfo {
  id: string;
  rows: number;
  cols: number;
  cwd: string | null;
  running: boolean;
}

export async function terminalCreate(
  cwd?: string,
  shell?: string,
  rows?: number,
  cols?: number
): Promise<TerminalInfo> {
  return await invoke<TerminalInfo>("terminal_create", {
    cwd,
    shell,
    rows,
    cols,
  });
}

export async function terminalWrite(id: string, data: number[]): Promise<void> {
  return await invoke<void>("terminal_write", { id, data });
}

export async function terminalResize(id: string, rows: number, cols: number): Promise<void> {
  return await invoke<void>("terminal_resize", { id, rows, cols });
}

export async function terminalKill(id: string): Promise<void> {
  return await invoke<void>("terminal_kill", { id });
}

export async function terminalInfo(id: string): Promise<TerminalInfo> {
  return await invoke<TerminalInfo>("terminal_info", { id });
}

export async function terminalList(): Promise<string[]> {
  return await invoke<string[]>("terminal_list");
}

// Git operations
export interface GitFileChange {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitStatusResponse {
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  changes: GitFileChange[];
  is_clean: boolean;
}

export interface GitCommitInfo {
  id: string;
  short_id: string;
  message: string;
  author: string;
  email: string;
  time: number;
}

export interface GitBranchInfo {
  name: string;
  is_current: boolean;
  is_remote: boolean;
  upstream: string | null;
}

export async function gitStatus(path: string): Promise<GitStatusResponse> {
  return await invoke<GitStatusResponse>("git_status", { path });
}

export async function gitStage(repoPath: string, filePath: string): Promise<void> {
  return await invoke<void>("git_stage", {
    repo_path: repoPath,
    file_path: filePath,
  });
}

export async function gitUnstage(repoPath: string, filePath: string): Promise<void> {
  return await invoke<void>("git_unstage", {
    repo_path: repoPath,
    file_path: filePath,
  });
}

export async function gitStageAll(repoPath: string): Promise<void> {
  return await invoke<void>("git_stage_all", { repo_path: repoPath });
}

export async function gitCommit(repoPath: string, message: string): Promise<GitCommitInfo> {
  return await invoke<GitCommitInfo>("git_commit", {
    repo_path: repoPath,
    message,
  });
}

export async function gitLog(repoPath: string, limit?: number): Promise<GitCommitInfo[]> {
  return await invoke<GitCommitInfo[]>("git_log", {
    repo_path: repoPath,
    limit,
  });
}

export async function gitBranches(repoPath: string): Promise<GitBranchInfo[]> {
  return await invoke<GitBranchInfo[]>("git_branches", { repo_path: repoPath });
}

export async function gitCheckout(repoPath: string, branch: string): Promise<void> {
  return await invoke<void>("git_checkout", { repo_path: repoPath, branch });
}

export async function gitDiscard(repoPath: string, filePath: string): Promise<void> {
  return await invoke<void>("git_discard", {
    repo_path: repoPath,
    file_path: filePath,
  });
}

export async function gitDiffFile(
  repoPath: string,
  filePath: string,
  staged: boolean
): Promise<string> {
  return await invoke<string>("git_diff_file", {
    repo_path: repoPath,
    file_path: filePath,
    staged,
  });
}

// Git blame info for a single line
export interface GitBlameLineInfo {
  line: number;
  commit_id: string;
  short_id: string;
  author: string;
  email: string;
  time: number;
  message: string;
}

export async function gitBlameFile(
  repoPath: string,
  filePath: string
): Promise<GitBlameLineInfo[]> {
  if (!isTauriEnvironment()) {
    return [];
  }
  return await invoke<GitBlameLineInfo[]>("git_blame_file", {
    repo_path: repoPath,
    file_path: filePath,
  });
}

// Tree Viewer operations
export async function getDepthRegions(bufferId: string): Promise<DepthRegionInfo[]> {
  if (!isTauriEnvironment()) {
    return [];
  }
  return await invoke<DepthRegionInfo[]>("get_depth_regions", {
    buffer_id: bufferId,
  });
}

export async function getFoldState(bufferId: string): Promise<FoldState> {
  if (!isTauriEnvironment()) {
    return { folded_lines: [], fold_ranges: {} };
  }
  return await invoke<FoldState>("get_fold_state", {
    buffer_id: bufferId,
  });
}

export async function toggleFold(bufferId: string, line: number): Promise<boolean> {
  if (!isTauriEnvironment()) {
    return false;
  }
  return await invoke<boolean>("toggle_fold", {
    buffer_id: bufferId,
    line,
  });
}

// Dependency analysis
export interface DependencyLink {
  id: string;
  from_symbol: string;
  to_symbol: string;
  from_line: number;
  to_line: number;
  from_column: number;
  to_column: number;
  type: "import" | "call" | "reference" | "extends" | "implements";
}

export async function analyzeDependencies(bufferId: string): Promise<DependencyLink[]> {
  if (!isTauriEnvironment()) {
    return [];
  }
  return await invoke<DependencyLink[]>("analyze_dependencies", {
    buffer_id: bufferId,
  });
}

// Environment Variable Management
export interface EnvVariableUsage {
  name: string;
  file_path: string;
  line: number;
  has_value: boolean;
}

export interface EnvVariableInfo {
  name: string;
  value: string | null;
  is_secret: boolean;
  usages: EnvVariableUsage[];
}

export interface EnvScanResult {
  variables: EnvVariableInfo[];
  env_files: string[];
  missing_in_env: string[];
  unused_in_code: string[];
}

export async function scanEnvVariables(projectPath: string): Promise<EnvScanResult> {
  if (!isTauriEnvironment()) {
    return {
      variables: [],
      env_files: [],
      missing_in_env: [],
      unused_in_code: [],
    };
  }
  return await invoke<EnvScanResult>("scan_env_variables", {
    project_path: projectPath,
  });
}

export async function generateEnvExample(projectPath: string): Promise<string> {
  if (!isTauriEnvironment()) {
    return "";
  }
  return await invoke<string>("generate_env_example", {
    project_path: projectPath,
  });
}

export async function generateEnvTypes(projectPath: string): Promise<string> {
  if (!isTauriEnvironment()) {
    return "";
  }
  return await invoke<string>("generate_env_types", {
    project_path: projectPath,
  });
}

export async function writeEnvExample(projectPath: string): Promise<void> {
  return await invoke<void>("write_env_example", {
    project_path: projectPath,
  });
}

export async function writeEnvTypes(projectPath: string): Promise<void> {
  return await invoke<void>("write_env_types", {
    project_path: projectPath,
  });
}
