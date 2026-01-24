/**
 * Autocomplete Component
 *
 * Displays LSP completion suggestions in a dropdown list.
 */

import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import type { LspCompletionItem } from "../../ipc/commands";

// Completion item kind icons (LSP spec)
const COMPLETION_KIND_ICONS: Record<number, string> = {
  1: "📝", // Text
  2: "⚡", // Method
  3: "🔧", // Function
  4: "🏗️", // Constructor
  5: "📦", // Field
  6: "📌", // Variable
  7: "📦", // Class
  8: "🔷", // Interface
  9: "📁", // Module
  10: "🔑", // Property
  11: "📐", // Unit
  12: "💎", // Value
  13: "📋", // Enum
  14: "🔤", // Keyword
  15: "📜", // Snippet
  16: "🎨", // Color
  17: "📄", // File
  18: "🔗", // Reference
  19: "📂", // Folder
  20: "📋", // EnumMember
  21: "🔢", // Constant
  22: "🏛️", // Struct
  23: "⚡", // Event
  24: "➕", // Operator
  25: "🔠", // TypeParameter
};

interface AutocompleteProps {
  items: LspCompletionItem[];
  visible: boolean;
  position: { x: number; y: number };
  onSelect: (item: LspCompletionItem) => void;
  onClose: () => void;
}

export function Autocomplete(props: AutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let listRef: HTMLDivElement | undefined;

  // Reset selection when items change
  createEffect(() => {
    if (props.items.length > 0) {
      setSelectedIndex(0);
    }
  });

  // Scroll selected item into view
  createEffect(() => {
    const index = selectedIndex();
    if (listRef) {
      const item = listRef.children[index] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  });

  // Handle keyboard navigation
  function handleKeyDown(e: KeyboardEvent) {
    if (!props.visible) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.min(i + 1, props.items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
      case "Tab": {
        e.preventDefault();
        e.stopPropagation();
        const selected = props.items[selectedIndex()];
        if (selected) {
          props.onSelect(selected);
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        props.onClose();
        break;
    }
  }

  // Attach keyboard listener when visible
  createEffect(() => {
    if (props.visible) {
      document.addEventListener("keydown", handleKeyDown, true);
    }
    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown, true);
    });
  });

  function getIcon(kind: number): string {
    return COMPLETION_KIND_ICONS[kind] || "•";
  }

  function getKindName(kind: number): string {
    const names: Record<number, string> = {
      1: "Text",
      2: "Method",
      3: "Function",
      4: "Constructor",
      5: "Field",
      6: "Variable",
      7: "Class",
      8: "Interface",
      9: "Module",
      10: "Property",
      11: "Unit",
      12: "Value",
      13: "Enum",
      14: "Keyword",
      15: "Snippet",
      16: "Color",
      17: "File",
      18: "Reference",
      19: "Folder",
      20: "EnumMember",
      21: "Constant",
      22: "Struct",
      23: "Event",
      24: "Operator",
      25: "TypeParameter",
    };
    return names[kind] || "Unknown";
  }

  return (
    <Show when={props.visible && props.items.length > 0}>
      <div
        class="fixed z-50 bg-bg-secondary border border-border rounded shadow-xl overflow-hidden"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
          "min-width": "300px",
          "max-width": "500px",
          "max-height": "300px",
        }}
      >
        {/* Item list */}
        <div ref={listRef} class="overflow-y-auto max-h-64">
          <For each={props.items}>
            {(item, index) => (
              <div
                class="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                classList={{
                  "bg-accent/20": index() === selectedIndex(),
                  "hover:bg-bg-hover": index() !== selectedIndex(),
                }}
                onClick={() => props.onSelect(item)}
                onMouseEnter={() => setSelectedIndex(index())}
              >
                {/* Icon */}
                <span class="w-5 text-center text-sm" title={getKindName(item.kind)}>
                  {getIcon(item.kind)}
                </span>

                {/* Label */}
                <span class="flex-1 text-text-primary text-sm truncate">{item.label}</span>

                {/* Detail */}
                <Show when={item.detail}>
                  <span class="text-text-tertiary text-xs truncate max-w-32">{item.detail}</span>
                </Show>
              </div>
            )}
          </For>
        </div>

        {/* Documentation preview */}
        <Show when={props.items[selectedIndex()]?.documentation}>
          <div class="border-t border-border p-3 bg-bg-tertiary max-h-32 overflow-y-auto">
            <div class="text-text-secondary text-xs whitespace-pre-wrap">
              {props.items[selectedIndex()]?.documentation}
            </div>
          </div>
        </Show>

        {/* Footer */}
        <div class="border-t border-border px-3 py-1 bg-bg-tertiary flex items-center justify-between text-xs text-text-tertiary">
          <span>{props.items.length} suggestions</span>
          <span>
            <kbd class="px-1 bg-bg-secondary rounded">↑↓</kbd> navigate
            <kbd class="px-1 bg-bg-secondary rounded ml-2">Tab</kbd> insert
            <kbd class="px-1 bg-bg-secondary rounded ml-2">Esc</kbd> close
          </span>
        </div>
      </div>
    </Show>
  );
}
