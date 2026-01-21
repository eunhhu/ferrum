/**
 * Context Action Palette Component
 *
 * Shows context-aware actions based on current selection/cursor position.
 * Includes AI-powered actions for code improvement, explanation, and fixing.
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
  category: "navigation" | "refactor" | "selection" | "info" | "ai";
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
  selectedText?: string;
  errorMessage?: string;
  onClose: () => void;
  onGotoLocation?: (location: LspLocation) => void;
  onSelectionChange?: (
    startLine: number,
    startChar: number,
    endLine: number,
    endChar: number
  ) => void;
  onShowAiPanel?: (action: string, code: string, error?: string) => void;
}

export function ContextActionPalette(props: ContextActionPaletteProps) {
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [actions, setActions] = createSignal<ContextAction[]>([]);
  const [filter, setFilter] = createSignal("");
  let listRef: HTMLDivElement | undefined;
  let inputRef: HTMLInputElement | undefined;

  // Build actions based on context
  createEffect(() => {
    if (props.visible) {
      buildActions();
      setFilter("");
      // Focus input after render
      setTimeout(() => inputRef?.focus(), 10);
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
            const hover = await lspHover(
              props.filePath,
              props.line,
              props.character
            );
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

    // AI-powered actions (only show when there's selected text)
    if (props.selectedText && props.selectedText.length > 0) {
      newActions.push({
        id: "ai-explain",
        label: "AI: Explain Code",
        icon: "💡",
        category: "ai",
        action: () => {
          props.onShowAiPanel?.("explain", props.selectedText || "");
          props.onClose();
        },
      });

      newActions.push({
        id: "ai-improve",
        label: "AI: Improve Code",
        icon: "✨",
        category: "ai",
        action: () => {
          props.onShowAiPanel?.("improve", props.selectedText || "");
          props.onClose();
        },
      });

      newActions.push({
        id: "ai-add-types",
        label: "AI: Add TypeScript Types",
        icon: "📝",
        category: "ai",
        action: () => {
          props.onShowAiPanel?.("add-types", props.selectedText || "");
          props.onClose();
        },
      });

      newActions.push({
        id: "ai-add-comments",
        label: "AI: Add Comments",
        icon: "📖",
        category: "ai",
        action: () => {
          props.onShowAiPanel?.("add-comments", props.selectedText || "");
          props.onClose();
        },
      });

      newActions.push({
        id: "ai-simplify",
        label: "AI: Simplify Code",
        icon: "🎯",
        category: "ai",
        action: () => {
          props.onShowAiPanel?.("simplify", props.selectedText || "");
          props.onClose();
        },
      });

      newActions.push({
        id: "ai-generate-tests",
        label: "AI: Generate Tests",
        icon: "🧪",
        category: "ai",
        action: () => {
          props.onShowAiPanel?.("generate-tests", props.selectedText || "");
          props.onClose();
        },
      });

      newActions.push({
        id: "ai-debug",
        label: "AI: Add Debug Logging",
        icon: "🐛",
        category: "ai",
        action: () => {
          props.onShowAiPanel?.("debug", props.selectedText || "");
          props.onClose();
        },
      });
    }

    // Show fix error action if there's an error
    if (props.errorMessage && props.selectedText) {
      newActions.unshift({
        id: "ai-fix-error",
        label: "AI: Fix Error",
        icon: "🔧",
        category: "ai",
        action: () => {
          props.onShowAiPanel?.(
            "fix-error",
            props.selectedText || "",
            props.errorMessage
          );
          props.onClose();
        },
      });
    }

    setActions(newActions);
    setSelectedIndex(0);
  };

  // Filter actions based on input
  const filteredActions = () => {
    const f = filter().toLowerCase();
    if (!f) return actions();
    return actions().filter(
      (a) =>
        a.label.toLowerCase().includes(f) ||
        a.category.toLowerCase().includes(f)
    );
  };

  // Keyboard navigation
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    const filtered = filteredActions();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        e.stopPropagation();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        e.stopPropagation();
        const selected = filtered[selectedIndex()];
        if (selected) {
          selected.action();
        }
        break;
      case "Tab":
        // Tab completion - execute first action
        e.preventDefault();
        e.stopPropagation();
        const first = filtered[0];
        if (first) {
          first.action();
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

  // Reset selection when filter changes
  createEffect(() => {
    filter();
    setSelectedIndex(0);
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
      case "ai":
        return "text-orange-400";
      default:
        return "text-gray-400";
    }
  };

  const getCategoryLabel = (category: ContextAction["category"]): string => {
    switch (category) {
      case "navigation":
        return "Navigation";
      case "refactor":
        return "Refactor";
      case "selection":
        return "Selection";
      case "info":
        return "Info";
      case "ai":
        return "AI";
      default:
        return "Other";
    }
  };

  // Group actions by category
  const groupedActions = () => {
    const filtered = filteredActions();
    const groups: Record<string, ContextAction[]> = {};

    for (const action of filtered) {
      if (!groups[action.category]) {
        groups[action.category] = [];
      }
      const categoryGroup = groups[action.category];
      if (categoryGroup) {
        categoryGroup.push(action);
      }
    }

    return groups;
  };

  // Calculate flat index for selection
  const getFlatIndex = (category: string, actionIndex: number): number => {
    const groups = groupedActions();
    let flatIndex = 0;

    for (const [cat, catActions] of Object.entries(groups)) {
      if (cat === category) {
        return flatIndex + actionIndex;
      }
      flatIndex += catActions.length;
    }

    return 0;
  };

  return (
    <Show when={props.visible && actions().length > 0}>
      <div
        class="fixed z-50 bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
          "min-width": "320px",
          "max-width": "450px",
        }}
      >
        {/* Search Input */}
        <div class="px-3 py-2 border-b border-border">
          <input
            ref={inputRef}
            type="text"
            class="w-full px-2 py-1.5 text-sm bg-bg-tertiary border border-border rounded text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
            placeholder="Search actions..."
            value={filter()}
            onInput={(e) => setFilter(e.currentTarget.value)}
          />
        </div>

        {/* Actions list */}
        <div ref={listRef} class="max-h-80 overflow-y-auto">
          <For each={Object.entries(groupedActions())}>
            {([category, categoryActions]) => (
              <div>
                {/* Category header */}
                <div class="px-3 py-1 bg-bg-tertiary/50 text-[10px] uppercase tracking-wider text-text-quaternary">
                  {getCategoryLabel(category as ContextAction["category"])}
                </div>

                {/* Actions in this category */}
                <For each={categoryActions}>
                  {(action, actionIndex) => {
                    const flatIndex = getFlatIndex(category, actionIndex());
                    return (
                      <button
                        class="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                        classList={{
                          "bg-accent/20": flatIndex === selectedIndex(),
                          "hover:bg-bg-hover": flatIndex !== selectedIndex(),
                        }}
                        onClick={() => action.action()}
                        onMouseEnter={() => setSelectedIndex(flatIndex)}
                      >
                        <span
                          class={`w-5 text-center ${getCategoryColor(
                            action.category
                          )}`}
                        >
                          {action.icon}
                        </span>
                        <span class="flex-1 text-text-primary text-sm">
                          {action.label}
                        </span>
                        <Show when={action.shortcut}>
                          <span class="text-text-tertiary text-xs font-mono bg-bg-tertiary px-1.5 py-0.5 rounded">
                            {action.shortcut}
                          </span>
                        </Show>
                      </button>
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>

        {/* Footer */}
        <div class="px-3 py-1.5 bg-bg-tertiary border-t border-border text-xs text-text-tertiary flex items-center justify-between">
          <span>
            <kbd class="px-1 bg-bg-secondary rounded">↑↓</kbd> navigate
          </span>
          <span>
            <kbd class="px-1 bg-bg-secondary rounded">Tab</kbd> quick action
          </span>
          <span>
            <kbd class="px-1 bg-bg-secondary rounded">Enter</kbd> select
          </span>
        </div>
      </div>
    </Show>
  );
}
