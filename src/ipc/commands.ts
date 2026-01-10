/**
 * Typed IPC commands for calling the Rust backend
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  FileContent,
  DirectoryEntry,
  BufferInfo,
  BufferMetrics,
  FileSearchResult,
  TextSearchResult,
  TextSearchOptions,
  Settings,
  ProjectInfo,
  FileTreeNode,
  ParseResult,
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
export async function searchFiles(
  query: string,
  limit?: number
): Promise<FileSearchResult[]> {
  return await invoke<FileSearchResult[]>("search_files", { query, limit });
}

export async function searchText(
  root: string,
  query: string,
  options?: TextSearchOptions
): Promise<TextSearchResult[]> {
  return await invoke<TextSearchResult[]>("search_text", { root, query, options });
}

// Settings operations
export async function getSettings(): Promise<Settings> {
  return await invoke<Settings>("get_settings");
}

export async function updateSettings(
  updates: Partial<Settings>
): Promise<Settings> {
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

export async function bufferGetLine(
  bufferId: string,
  line: number
): Promise<string | null> {
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

// Project operations
export async function openProject(path: string): Promise<ProjectInfo> {
  return await invoke<ProjectInfo>("open_project", { path });
}

export async function getFileTree(
  path: string,
  maxDepth?: number
): Promise<FileTreeNode[]> {
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

export async function getRecentProjects(): Promise<ProjectInfo[]> {
  return await invoke<ProjectInfo[]>("get_recent_projects");
}

// Syntax highlighting
export async function getHighlights(
  bufferId: string,
  startByte?: number,
  endByte?: number
): Promise<ParseResult> {
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
