/**
 * Tauri environment detection and safe invoke wrapper
 */

import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/**
 * Check if running in Tauri environment
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Safe invoke that returns undefined in non-Tauri environments
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T | undefined> {
  if (!isTauriEnvironment()) {
    console.debug(`[IPC] Skipping command "${command}" - not in Tauri environment`);
    return undefined;
  }

  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    console.error(`[IPC] Command "${command}" failed:`, error);
    throw error;
  }
}

/**
 * Safe invoke with fallback value for non-Tauri environments
 */
export async function safeInvokeWithFallback<T>(
  command: string,
  args: Record<string, unknown> | undefined,
  fallback: T
): Promise<T> {
  if (!isTauriEnvironment()) {
    console.debug(`[IPC] Using fallback for "${command}" - not in Tauri environment`);
    return fallback;
  }

  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    console.error(`[IPC] Command "${command}" failed, using fallback:`, error);
    return fallback;
  }
}
