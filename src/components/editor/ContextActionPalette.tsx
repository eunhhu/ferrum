/**
 * Context Action Palette Component
 *
 * Shows context-aware actions based on current selection/cursor position.
 * Similar to VS Code's "Quick Fix" or "Code Actions" menu.
 */

import { createSignal, createEffect, For, Show, onCleanup } from "solid-js";
import {
  lspGotoDefinition,
  lspReferences,
  lspHover,
  expandSelection,
  shrinkSelection,
  type LspLocation,
} from "../../ipc/commands";

interface ContextAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  category: "navigation" | "refactor" | "selection" | "info";
}

interface ContextActionPaletteProps {
  visible: boolean;
  position: { x: number; y: number };
  filePath: string | null;
  bufferId: string | null;
  line: number;
  character: number;
  selectionStartByte: number;
  selectionEndByte: number;
  onClose: () => void;
  onGotoLocation?: (location: LspLocation) => void;
  onSelectionChange?: (startLine: number, startChar: number, endLine: number, endChar: number) => void;
}

export function ContextActionPalette(props: ContextActionPaletteProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [actions, setActions] = createSignal<ContextAction[]>([]);
  let listRef: HTMLDivElement | undefined;

  // Build actions based on context
  createEffect(() => {
    if (props.visible) {
      buildActions();
    }
  });

  const buildActions = async () => {
    const newActions: ContextAction[] = [];

    // Selection-based actions
    if (props.bufferId) {
      newActions.push({
        id: "expand-selection",
        label: "Expand Selection",
        icon: "⬆",
        shortcut: "⌥↑",
        category: "selection",
        action: async () => {
          if (!props.bufferId) return;
          try {
            const range = await expandSelection(
              props.bufferId,
              props.selectionStartByte,
              props.selectionEndByte
            );
            props.onSelectionChange?.(
              range.start_line,
              range.start_character,
              range.end_line,
              range.end_character
            );
          } catch (e) {
            console.error("Expand selection failed:", e);
          }
          props.onClose();
        },
      });

      newActions.push({
        id: "shrink-selection",
        label: "Shrink Selection",
        icon: "⬇",
        shortcut: "⌥↓",
        category: "selection",
        action: async () => {
          if (!props.bufferId) return;
          try {
            const range = await shrinkSelection(
              props.bufferId,
              props.selectionStartByte,
              props.selectionEndByte
            );
            props.onSelectionChange?.(
              range.start_line,
              range.start_character,
              range.end_line,
              range.end_character
            );
          } catch (e) {
            console.error("Shrink selection failed:", e);
          }
          props.onClose();
        },
      });
    }

    // LSP-based actions
    if (props.filePath) {
      newActions.push({
        id: "goto-definition",
        label: "Go to Definition",
        icon: "→",
        shortcut: "F12",
        category: "navigation",
        action: async () => {
          if (!props.filePath) return;
          try {
            const locations = await lspGotoDefinition(
              props.filePath,
              props.line,
              props.character
            );
            if (locations.length > 0 && locations[0]) {
              props.onGotoLocation?.(locations[0]);
            }
          } catch (e) {
            console.error("Go to definition failed:", e);
          }
          props.onClose();
        },
      });

      newActions.push({
        id: "find-references",
        label: "Find All References",
        icon: "🔍",
        shortcut: "⇧F12",
        category: "navigation",
        action: async () => {
          if (!props.filePath) return;
          try {
            const locations = await lspReferences(
              props.filePath,
              props.line,
              props.character,
              true
            );
            // TODO: Show references in a panel
            console.log("References:", locations);
          } catch (e) {
            console.error("Find references failed:", e);
          }
          props.onClose();
        },
      });

      newActions.push({
        id: "peek-definition",
        label: "Peek Definition",
        icon: "👁",
        shortcut: "⌥F12",
        category: "navigation",
        action: async () => {
          // TODO: Implement peek view
          props.onClose();
        },
      });

      newActions.push({
        id: "show-hover",
        label: "Show Hover Info",
        icon: "ℹ",
        category: "info",
        action: async () => {
          if (!props.filePath) return;
          try {
            const hover = await lspHover(props.filePath, props.line, props.character);
            if (hover) {
              console.log("Hover:", hover.contents);
            }
          } catch (e) {
            console.error("Hover failed:", e);
          }
          props.onClose();
        },
      });
    }

    setActions(newActions);
    setSelectedIndex(0);
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.min(i + 1, actions().length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        const selected = actions()[selectedIndex()];
        if (selected) {
          selected.action();
        }
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        props.onClose();
        break;
    }
  };

  createEffect(() => {
    if (props.visible) {
      document.addEventListener("keydown", handleKeyDown, true);
    }
    onCleanup(() => {
      document.removeEventListener("keydown", handleKeyDown, true);
    });
  });

  // Scroll selected item into view
  createEffect(() => {
    const index = selectedIndex();
    if (listRef) {
      const item = listRef.children[index] as HTMLElement | undefined;
      item?.scrollIntoView({ block: "nearest" });
    }
  });

  const getCategoryColor = (category: ContextAction["category"]): string => {
    switch (category) {
      case "navigation":
        return "text-blue-400";
      case "refactor":
        return "text-yellow-400";
      case "selection":
        return "text-green-400";
      case "info":
        return "text-purple-400";
      default:
        return "text-gray-400";
    }
  };

  return (
    <Show when={props.visible && actions().length > 0}>
      <div
        class="fixed z-50 bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
          "min-width": "280px",
          "max-width": "400px",
        }}
      >
        {/* Header */}
        <div class="px-3 py-2 bg-bg-tertiary border-b border-border text-xs text-text-secondary font-medium">
          Context Actions
        </div>

        {/* Actions list */}
        <div ref={listRef} class="max-h-64 overflow-y-auto py-1">
          <For each={actions()}>
            {(action, index) => (
              <button
                class="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                classList={{
                  "bg-accent/20": index() === selectedIndex(),
                  "hover:bg-bg-hover": index() !== selectedIndex(),
                }}
                onClick={() => action.action()}
                onMouseEnter={() => setSelectedIndex(index())}
              >
                <span class={`w-5 text-center ${getCategoryColor(action.category)}`}>
                  {action.icon}
                </span>
                <span class="flex-1 text-text-primary text-sm">{action.label}</span>
                <Show when={action.shortcut}>
                  <span class="text-text-tertiary text-xs font-mono bg-bg-tertiary px-1.5 py-0.5 rounded">
                    {action.shortcut}
                  </span>
                </Show>
              </button>
            )}
          </For>
        </div>

        {/* Footer */}
        <div class="px-3 py-1.5 bg-bg-tertiary border-t border-border text-xs text-text-tertiary flex items-center justify-between">
          <span>
            <kbd class="px-1 bg-bg-secondary rounded">↑↓</kbd> navigate
          </span>
          <span>
            <kbd class="px-1 bg-bg-secondary rounded">Enter</kbd> select
          </span>
        </div>
      </div>
    </Show>
  );
}
