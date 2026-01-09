/**
 * Typed IPC commands for calling the Rust backend
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  IpcResponse,
  FileContent,
  DirectoryEntry,
  BufferInfo,
  FileSearchResult,
  TextSearchResult,
  TextSearchOptions,
  Settings,
} from "./types";

// Helper to unwrap IPC responses
function unwrap<T>(response: IpcResponse<T>): T {
  if (response.status === "error") {
    throw new Error(`${response.error.code}: ${response.error.message}`);
  }
  return response.data;
}

// File operations
export async function readFile(path: string): Promise<FileContent> {
  const response = await invoke<IpcResponse<FileContent>>("read_file", { path });
  return unwrap(response);
}

export async function writeFile(path: string, content: string): Promise<void> {
  const response = await invoke<IpcResponse<void>>("write_file", {
    path,
    content,
  });
  return unwrap(response);
}

export async function listDirectory(path: string): Promise<DirectoryEntry[]> {
  const response = await invoke<IpcResponse<DirectoryEntry[]>>("list_directory", { path });
  return unwrap(response);
}

// Buffer operations
export async function createBuffer(content?: string): Promise<BufferInfo> {
  const response = await invoke<IpcResponse<BufferInfo>>("create_buffer", {
    content,
  });
  return unwrap(response);
}

export async function bufferInsert(
  bufferId: string,
  position: number,
  text: string
): Promise<BufferInfo> {
  const response = await invoke<IpcResponse<BufferInfo>>("buffer_insert", {
    buffer_id: bufferId,
    position,
    text,
  });
  return unwrap(response);
}

export async function bufferDelete(
  bufferId: string,
  start: number,
  end: number
): Promise<BufferInfo> {
  const response = await invoke<IpcResponse<BufferInfo>>("buffer_delete", {
    buffer_id: bufferId,
    start,
    end,
  });
  return unwrap(response);
}

export async function bufferContent(bufferId: string): Promise<BufferInfo> {
  const response = await invoke<IpcResponse<BufferInfo>>("buffer_content", {
    buffer_id: bufferId,
  });
  return unwrap(response);
}

// Search operations
export async function searchFiles(
  query: string,
  limit?: number
): Promise<FileSearchResult[]> {
  const response = await invoke<IpcResponse<FileSearchResult[]>>("search_files", {
    query,
    limit,
  });
  return unwrap(response);
}

export async function searchText(
  root: string,
  query: string,
  options?: TextSearchOptions
): Promise<TextSearchResult[]> {
  const response = await invoke<IpcResponse<TextSearchResult[]>>("search_text", {
    root,
    query,
    options,
  });
  return unwrap(response);
}

// Settings operations
export async function getSettings(): Promise<Settings> {
  const response = await invoke<IpcResponse<Settings>>("get_settings");
  return unwrap(response);
}

export async function updateSettings(
  updates: Partial<Settings>
): Promise<Settings> {
  const response = await invoke<IpcResponse<Settings>>("update_settings", {
    updates,
  });
  return unwrap(response);
}
