/**
 * File Watcher Hook
 *
 * Watches directories for file system changes using Tauri backend.
 */

import { createSignal, onCleanup } from "solid-js";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import * as ipc from "../ipc/commands";

/** File system event types */
export type FsEventType = "Created" | "Modified" | "Deleted" | "Renamed";

/** File system event */
export interface FsEvent {
  type: FsEventType;
  path: string;
  /** For rename events, the new path */
  to?: string;
}

/** File watcher state */
export interface FileWatcherState {
  isWatching: boolean;
  watchedPaths: Set<string>;
  lastEvent: FsEvent | null;
}

/**
 * Create a file watcher for a directory
 */
export function useFileWatcher(onEvent?: (event: FsEvent) => void) {
  const [state, setState] = createSignal<FileWatcherState>({
    isWatching: false,
    watchedPaths: new Set(),
    lastEvent: null,
  });

  let unlistenChange: UnlistenFn | null = null;
  let unlistenStart: UnlistenFn | null = null;

  // Setup event listeners
  async function setupListeners() {
    if (unlistenChange) return;

    unlistenChange = await listen<FsEvent | { type: string; path: string; from?: string; to?: string }>(
      "fs:change",
      (event) => {
        // Normalize event payload
        let fsEvent: FsEvent;
        const payload = event.payload;

        if (payload.type === "Renamed" && "from" in payload && "to" in payload) {
          fsEvent = {
            type: "Renamed",
            path: payload.from as string,
            to: payload.to as string,
          };
        } else {
          fsEvent = {
            type: payload.type as FsEventType,
            path: payload.path,
          };
        }

        setState((prev) => ({
          ...prev,
          lastEvent: fsEvent,
        }));

        onEvent?.(fsEvent);
      }
    );

    unlistenStart = await listen<string>("fs:watch_started", (event) => {
      setState((prev) => {
        const paths = new Set(prev.watchedPaths);
        paths.add(event.payload);
        return {
          ...prev,
          isWatching: true,
          watchedPaths: paths,
        };
      });
    });
  }

  // Watch a directory
  async function watch(path: string) {
    await setupListeners();

    try {
      await ipc.watchDirectory(path);
    } catch (e) {
      console.error("Failed to watch directory:", e);
    }
  }

  // Unwatch a directory
  async function unwatch(path: string) {
    try {
      await ipc.unwatchDirectory(path);
      setState((prev) => {
        const paths = new Set(prev.watchedPaths);
        paths.delete(path);
        return {
          ...prev,
          watchedPaths: paths,
          isWatching: paths.size > 0,
        };
      });
    } catch (e) {
      console.error("Failed to unwatch directory:", e);
    }
  }

  // Cleanup on unmount
  onCleanup(() => {
    unlistenChange?.();
    unlistenStart?.();
  });

  return {
    state,
    watch,
    unwatch,
  };
}

/**
 * Create a reactive file watcher that automatically refreshes data
 */
export function useAutoRefresh<T>(
  path: () => string | null,
  fetchData: () => Promise<T>,
  options?: {
    debounceMs?: number;
    eventTypes?: FsEventType[];
  }
) {
  const [data, setData] = createSignal<T | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const debounceMs = options?.debounceMs ?? 200;
  const eventTypes = options?.eventTypes ?? ["Created", "Modified", "Deleted", "Renamed"];

  let debounceTimeout: ReturnType<typeof setTimeout>;

  // Debounced refresh function
  const refresh = () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const result = await fetchData();
        setData(() => result);
        setError(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);
  };

  const { state, watch, unwatch } = useFileWatcher((event) => {
    // Check if this event type should trigger refresh
    if (eventTypes.includes(event.type)) {
      refresh();
    }
  });

  // Initial fetch
  refresh();

  // Watch path changes
  let currentPath: string | null = null;

  const startWatching = async () => {
    const watchPath = path();

    if (watchPath === currentPath) return;

    // Unwatch old path
    if (currentPath) {
      await unwatch(currentPath);
    }

    // Watch new path
    if (watchPath) {
      await watch(watchPath);
      currentPath = watchPath;
    }
  };

  // Call startWatching initially
  startWatching();

  return {
    data,
    isLoading,
    error,
    refresh,
    watcherState: state,
  };
}
