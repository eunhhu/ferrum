/**
 * Navigation Trail Component (Breadcrumb)
 * 
 * Shows the current file path and symbol hierarchy at the top of the editor.
 * Allows quick navigation to parent directories and symbols.
 */

import { createSignal, createEffect, For, Show } from "solid-js";
import { lspDocumentSymbols, type LspSymbolInfo } from "../../ipc/commands";

interface NavigationTrailProps {
  filePath: string | null;
  currentLine: number;
  onNavigate?: (path: string) => void;
  onSymbolClick?: (symbol: LspSymbolInfo) => void;
}

// Symbol kind to icon mapping
const SYMBOL_ICONS: Record<number, string> = {
  1: "📄",   // File
  2: "📦",   // Module
  3: "🏷️",   // Namespace
  4: "📦",   // Package
  5: "🔷",   // Class
  6: "⚡",   // Method
  7: "🔑",   // Property
  8: "📌",   // Field
  9: "🏗️",   // Constructor
  10: "📋",  // Enum
  11: "🔶",  // Interface
  12: "ƒ",   // Function
  13: "📌",  // Variable
  14: "🔢",  // Constant
  15: "📝",  // String
  16: "🔢",  // Number
  17: "✓",   // Boolean
  18: "[]",  // Array
  19: "{}",  // Object
  20: "🔑",  // Key
  21: "∅",   // Null
  22: "📋",  // EnumMember
  23: "🏛️",  // Struct
  24: "⚡",  // Event
  25: "➕",  // Operator
  26: "🔠",  // TypeParameter
};

export function NavigationTrail(props: NavigationTrailProps) {
  const [pathParts, setPathParts] = createSignal<string[]>([]);
  const [symbols, setSymbols] = createSignal<LspSymbolInfo[]>([]);
  const [activeSymbols, setActiveSymbols] = createSignal<LspSymbolInfo[]>([]);

  // Parse file path into parts
  createEffect(() => {
    if (props.filePath) {
      const parts = props.filePath.split("/").filter(Boolean);
      // Show last 3 parts for brevity
      setPathParts(parts.slice(-3));
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
    } catch (e) {
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

  const handlePathClick = (index: number) => {
    if (!props.filePath || !props.onNavigate) return;
    const parts = props.filePath.split("/").filter(Boolean);
    const fullParts = parts.slice(0, parts.length - pathParts().length + index + 1);
    props.onNavigate("/" + fullParts.join("/"));
  };

  const getSymbolIcon = (kind: number): string => {
    return SYMBOL_ICONS[kind] || "•";
  };

  return (
    <div class="navigation-trail flex items-center h-7 px-3 bg-bg-secondary border-b border-border text-xs font-mono overflow-x-auto">
      {/* File path breadcrumb */}
      <div class="flex items-center gap-1 text-text-secondary">
        <For each={pathParts()}>
          {(part, index) => (
            <>
              <Show when={index() > 0}>
                <span class="text-text-tertiary mx-1">/</span>
              </Show>
              <button
                class="hover:text-text-primary hover:bg-bg-hover px-1.5 py-0.5 rounded transition-colors"
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
        <span class="text-text-tertiary mx-2">›</span>
      </Show>

      {/* Symbol breadcrumb */}
      <div class="flex items-center gap-1">
        <For each={activeSymbols()}>
          {(symbol, index) => (
            <>
              <Show when={index() > 0}>
                <span class="text-text-tertiary mx-1">›</span>
              </Show>
              <button
                class="flex items-center gap-1 hover:text-text-primary hover:bg-bg-hover px-1.5 py-0.5 rounded transition-colors text-text-secondary"
                onClick={() => props.onSymbolClick?.(symbol)}
                title={`Go to ${symbol.name} (line ${symbol.range.start.line + 1})`}
              >
                <span class="text-[10px]">{getSymbolIcon(symbol.kind)}</span>
                <span>{symbol.name}</span>
              </button>
            </>
          )}
        </For>
      </div>

      {/* Empty state */}
      <Show when={pathParts().length === 0}>
        <span class="text-text-tertiary italic">No file open</span>
      </Show>
    </div>
  );
}
