/**
 * Navigation History Store
 *
 * Manages navigation history for back/forward navigation.
 * Supports Cmd+[ (back) and Cmd+] (forward) shortcuts.
 */

import { createSignal } from "solid-js";

export interface NavigationEntry {
  id: string;
  filePath: string;
  line: number;
  column: number;
  symbolPath: string[];
  timestamp: number;
  label: string;
}

interface NavigationState {
  entries: NavigationEntry[];
  currentIndex: number;
}

const MAX_HISTORY_SIZE = 50;

// State
const [state, setState] = createSignal<NavigationState>({
  entries: [],
  currentIndex: -1,
});

let nextId = 1;

/**
 * Push a new navigation entry
 */
export function pushNavigation(
  filePath: string,
  line: number,
  column: number,
  symbolPath: string[] = []
): NavigationEntry {
  const current = state();

  // Avoid duplicate consecutive entries (same file, within 5 lines)
  const lastEntry = current.entries[current.currentIndex];
  if (lastEntry && lastEntry.filePath === filePath && Math.abs(lastEntry.line - line) <= 5) {
    // Update existing entry instead
    const updated = { ...lastEntry, line, column, symbolPath };
    const newEntries = [...current.entries];
    newEntries[current.currentIndex] = updated;
    setState({ ...current, entries: newEntries });
    return updated;
  }

  // Create new entry
  const entry: NavigationEntry = {
    id: `nav-${nextId++}`,
    filePath,
    line,
    column,
    symbolPath,
    timestamp: Date.now(),
    label: `${filePath.split("/").pop()}:${line + 1}`,
  };

  // Truncate forward history when pushing new entry
  const entries = current.entries.slice(0, current.currentIndex + 1);
  entries.push(entry);

  // Enforce max size
  if (entries.length > MAX_HISTORY_SIZE) {
    entries.shift();
  }

  setState({
    entries,
    currentIndex: entries.length - 1,
  });

  return entry;
}

/**
 * Navigate back in history
 */
export function navigateBack(): NavigationEntry | null {
  const current = state();

  if (current.currentIndex > 0) {
    const newIndex = current.currentIndex - 1;
    setState({ ...current, currentIndex: newIndex });
    return current.entries[newIndex] ?? null;
  }

  return null;
}

/**
 * Navigate forward in history
 */
export function navigateForward(): NavigationEntry | null {
  const current = state();

  if (current.currentIndex < current.entries.length - 1) {
    const newIndex = current.currentIndex + 1;
    setState({ ...current, currentIndex: newIndex });
    return current.entries[newIndex] ?? null;
  }

  return null;
}

/**
 * Navigate to a specific history index
 */
export function navigateToIndex(index: number): NavigationEntry | null {
  const current = state();

  if (index >= 0 && index < current.entries.length) {
    setState({ ...current, currentIndex: index });
    return current.entries[index] ?? null;
  }

  return null;
}

/**
 * Get navigation state (readonly)
 */
export function getNavigationState(): NavigationState {
  return state();
}

/**
 * Check if can go back
 */
export function canGoBack(): boolean {
  return state().currentIndex > 0;
}

/**
 * Check if can go forward
 */
export function canGoForward(): boolean {
  const current = state();
  return current.currentIndex < current.entries.length - 1;
}

/**
 * Clear navigation history
 */
export function clearNavigationHistory(): void {
  setState({ entries: [], currentIndex: -1 });
}

/**
 * Get current entry
 */
export function getCurrentEntry(): NavigationEntry | null {
  const current = state();
  return current.entries[current.currentIndex] ?? null;
}
