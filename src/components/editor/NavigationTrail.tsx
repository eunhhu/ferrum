/**
 * Navigation Trail Component (Breadcrumb + History)
 *
 * Shows the current file path and symbol hierarchy at the top of the editor.
 * Includes back/forward navigation buttons for history traversal.
 */

import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { type LspSymbolInfo, lspDocumentSymbols } from "../../ipc/commands";
import {
  canGoBack,
  canGoForward,
  getNavigationState,
  type NavigationEntry,
  navigateBack,
  navigateForward,
  navigateToIndex,
  pushNavigation,
} from "../../stores/navigationStore";

interface NavigationTrailProps {
  filePath: string | null;
  currentLine: number;
  onNavigate?: (entry: NavigationEntry) => void;
  onSymbolClick?: (symbol: LspSymbolInfo) => void;
}

// Symbol kind to icon mapping
const SYMBOL_ICONS: Record<number, string> = {
  1: "📄", // File
  2: "📦", // Module
  3: "🏷️", // Namespace
  4: "📦", // Package
  5: "🔷", // Class
  6: "⚡", // Method
  7: "🔑", // Property
  8: "📌", // Field
  9: "🏗️", // Constructor
  10: "📋", // Enum
  11: "🔶", // Interface
  12: "ƒ", // Function
  13: "📌", // Variable
  14: "🔢", // Constant
  15: "📝", // String
  16: "🔢", // Number
  17: "✓", // Boolean
  18: "[]", // Array
  19: "{}", // Object
  20: "🔑", // Key
  21: "∅", // Null
  22: "📋", // EnumMember
  23: "🏛️", // Struct
  24: "⚡", // Event
  25: "➕", // Operator
  26: "🔠", // TypeParameter
};

export function NavigationTrail(props: NavigationTrailProps) {
  const [pathParts, setPathParts] = createSignal<string[]>([]);
  const [symbols, setSymbols] = createSignal<LspSymbolInfo[]>([]);
  const [activeSymbols, setActiveSymbols] = createSignal<LspSymbolInfo[]>([]);
  const [showHistory, setShowHistory] = createSignal(false);
  const [, setRefreshTrigger] = createSignal(0);

  // Parse file path into parts
  createEffect(() => {
    if (props.filePath) {
      const parts = props.filePath.split("/").filter(Boolean);
      // Show last 3 parts for brevity
      setPathParts(parts.slice(-3));

      // Push to navigation history
      pushNavigation(
        props.filePath,
        props.currentLine,
        0,
        activeSymbols().map((s) => s.name)
      );
    } else {
      setPathParts([]);
    }
  });

  // Load document symbols
  createEffect(() => {
    if (props.filePath) {
      loadSymbols();
    }
  });

  const loadSymbols = async () => {
    if (!props.filePath) return;
    try {
      const syms = await lspDocumentSymbols(props.filePath);
      setSymbols(syms);
    } catch {
      // LSP might not be running, that's okay
      setSymbols([]);
    }
  };

  // Find symbols containing the current line
  createEffect(() => {
    const line = props.currentLine;
    const allSymbols = symbols();
    const active: LspSymbolInfo[] = [];

    const findContaining = (syms: LspSymbolInfo[]) => {
      for (const sym of syms) {
        if (line >= sym.range.start.line && line <= sym.range.end.line) {
          active.push(sym);
          if (sym.children) {
            findContaining(sym.children);
          }
        }
      }
    };

    findContaining(allSymbols);
    setActiveSymbols(active);
  });

  // Keyboard shortcut handler
  const handleKeyDown = (e: KeyboardEvent) => {
    const isMod = e.metaKey || e.ctrlKey;

    if (isMod && e.key === "[") {
      e.preventDefault();
      handleBack();
    } else if (isMod && e.key === "]") {
      e.preventDefault();
      handleForward();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  const handleBack = () => {
    const entry = navigateBack();
    if (entry) {
      props.onNavigate?.(entry);
      setRefreshTrigger((n) => n + 1);
    }
  };

  const handleForward = () => {
    const entry = navigateForward();
    if (entry) {
      props.onNavigate?.(entry);
      setRefreshTrigger((n) => n + 1);
    }
  };

  const handleHistoryClick = (index: number) => {
    const entry = navigateToIndex(index);
    if (entry) {
      props.onNavigate?.(entry);
      setShowHistory(false);
      setRefreshTrigger((n) => n + 1);
    }
  };

  const handlePathClick = (index: number) => {
    if (!(props.filePath && props.onNavigate)) return;
    const parts = props.filePath.split("/").filter(Boolean);
    const fullParts = parts.slice(0, parts.length - pathParts().length + index + 1);
    const path = "/" + fullParts.join("/");

    // Create a synthetic navigation entry for directory
    const entry: NavigationEntry = {
      id: `dir-${Date.now()}`,
      filePath: path,
      line: 0,
      column: 0,
      symbolPath: [],
      timestamp: Date.now(),
      label: path.split("/").pop() || path,
    };
    props.onNavigate(entry);
  };

  const getSymbolIcon = (kind: number): string => {
    return SYMBOL_ICONS[kind] || "•";
  };

  const navState = () => getNavigationState();

  return (
    <div class="navigation-trail flex items-center h-7 px-2 bg-bg-secondary border-b border-border text-xs font-mono overflow-hidden">
      {/* Back/Forward buttons */}
      <div class="flex items-center gap-0.5 mr-2">
        <button
          class="p-1 rounded hover:bg-bg-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={handleBack}
          disabled={!canGoBack()}
          title="Go Back (Cmd+[)"
        >
          <svg
            class="w-3.5 h-3.5 text-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <button
          class="p-1 rounded hover:bg-bg-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          onClick={handleForward}
          disabled={!canGoForward()}
          title="Go Forward (Cmd+])"
        >
          <svg
            class="w-3.5 h-3.5 text-text-secondary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>

        {/* History dropdown toggle */}
        <button
          class="p-1 rounded hover:bg-bg-hover transition-colors ml-0.5"
          onClick={() => setShowHistory(!showHistory())}
          title="Show Navigation History"
        >
          <svg
            class="w-3.5 h-3.5 text-text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>
      </div>

      {/* Separator */}
      <div class="w-px h-4 bg-border mr-2" />

      {/* File path breadcrumb */}
      <div class="flex items-center gap-1 text-text-secondary overflow-hidden">
        <For each={pathParts()}>
          {(part, index) => (
            <>
              <Show when={index() > 0}>
                <span class="text-text-tertiary mx-0.5">/</span>
              </Show>
              <button
                class="hover:text-text-primary hover:bg-bg-hover px-1 py-0.5 rounded transition-colors truncate max-w-32"
                onClick={() => handlePathClick(index())}
              >
                {part}
              </button>
            </>
          )}
        </For>
      </div>

      {/* Separator */}
      <Show when={pathParts().length > 0 && activeSymbols().length > 0}>
        <span class="text-text-tertiary mx-1.5">›</span>
      </Show>

      {/* Symbol breadcrumb */}
      <div class="flex items-center gap-1 overflow-hidden">
        <For each={activeSymbols()}>
          {(symbol, index) => (
            <>
              <Show when={index() > 0}>
                <span class="text-text-tertiary mx-0.5">›</span>
              </Show>
              <button
                class="flex items-center gap-1 hover:text-text-primary hover:bg-bg-hover px-1 py-0.5 rounded transition-colors text-text-secondary truncate max-w-40"
                onClick={() => props.onSymbolClick?.(symbol)}
                title={`Go to ${symbol.name} (line ${symbol.range.start.line + 1})`}
              >
                <span class="text-[10px] flex-shrink-0">{getSymbolIcon(symbol.kind)}</span>
                <span class="truncate">{symbol.name}</span>
              </button>
            </>
          )}
        </For>
      </div>

      {/* Empty state */}
      <Show when={pathParts().length === 0}>
        <span class="text-text-tertiary italic">No file open</span>
      </Show>

      {/* History dropdown */}
      <Show when={showHistory()}>
        <div
          class="absolute left-2 top-7 z-50 bg-bg-secondary border border-border rounded-lg shadow-xl max-h-64 overflow-auto min-w-64"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="px-3 py-2 border-b border-border text-text-tertiary text-xs font-medium">
            Navigation History
          </div>
          <div class="py-1">
            <Show
              when={navState().entries.length > 0}
              fallback={<div class="px-3 py-2 text-text-quaternary text-xs">No history yet</div>}
            >
              <For each={navState().entries}>
                {(entry, index) => (
                  <button
                    class="w-full px-3 py-1.5 text-left hover:bg-bg-hover transition-colors flex items-center gap-2"
                    classList={{
                      "bg-accent/10": index() === navState().currentIndex,
                    }}
                    onClick={() => handleHistoryClick(index())}
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      classList={{
                        "bg-accent": index() === navState().currentIndex,
                        "bg-text-quaternary": index() !== navState().currentIndex,
                      }}
                    />
                    <span class="text-text-primary text-xs truncate">{entry.label}</span>
                    <span class="text-text-quaternary text-[10px] ml-auto flex-shrink-0">
                      {formatTime(entry.timestamp)}
                    </span>
                  </button>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}
