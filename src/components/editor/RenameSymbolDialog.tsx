/**
 * Rename Symbol Dialog Component
 *
 * Dialog for renaming symbols using LSP rename functionality.
 */

import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import * as ipc from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";

interface RenameSymbolDialogProps {
  visible: boolean;
  currentName: string;
  position: { x: number; y: number };
  onRename: (newName: string) => void;
  onClose: () => void;
}

export function RenameSymbolDialog(props: RenameSymbolDialogProps) {
  const [newName, setNewName] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  let inputRef: HTMLInputElement | undefined;

  createEffect(() => {
    if (props.visible) {
      setNewName(props.currentName);
      setError(null);
      setTimeout(() => {
        inputRef?.focus();
        inputRef?.select();
      }, 10);
    }
  });

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      handleRename();
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

  const handleRename = () => {
    const name = newName().trim();

    if (!name) {
      setError("Name cannot be empty");
      return;
    }

    if (name === props.currentName) {
      props.onClose();
      return;
    }

    // Basic validation for identifier
    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)) {
      setError("Invalid identifier name");
      return;
    }

    props.onRename(name);
  };

  return (
    <Show when={props.visible}>
      <div
        class="absolute z-50 bg-bg-secondary border border-border rounded-lg shadow-xl overflow-hidden"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
          width: "350px",
        }}
      >
        {/* Header */}
        <div class="px-3 py-2 border-b border-border bg-bg-tertiary flex items-center gap-2">
          <svg class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
          <span class="text-sm font-medium text-text-primary">Rename Symbol</span>
        </div>

        {/* Content */}
        <div class="p-3">
          <div class="mb-2 text-xs text-text-secondary">
            Rename <span class="font-mono text-accent">{props.currentName}</span> to:
          </div>

          <input
            ref={inputRef}
            type="text"
            class="w-full px-3 py-2 text-sm bg-bg-tertiary border border-border rounded text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent font-mono"
            placeholder="New name..."
            value={newName()}
            onInput={(e) => {
              setNewName(e.currentTarget.value);
              setError(null);
            }}
          />

          <Show when={error()}>
            <div class="mt-2 text-xs text-error">{error()}</div>
          </Show>
        </div>

        {/* Footer */}
        <div class="px-3 py-2 border-t border-border bg-bg-tertiary flex items-center justify-between">
          <div class="text-xs text-text-tertiary">
            <kbd class="px-1 bg-bg-secondary rounded">Enter</kbd> Rename
            <span class="mx-2">|</span>
            <kbd class="px-1 bg-bg-secondary rounded">Esc</kbd> Cancel
          </div>
          <div class="flex gap-2">
            <button
              class="px-3 py-1 text-sm text-text-secondary hover:text-text-primary rounded hover:bg-bg-hover transition-colors"
              onClick={props.onClose}
            >
              Cancel
            </button>
            <button
              class="px-3 py-1 text-sm bg-accent text-white rounded hover:bg-accent/90 transition-colors"
              onClick={handleRename}
            >
              Rename
            </button>
          </div>
        </div>
      </div>
    </Show>
  );
}

// Helper function to perform rename via LSP
export async function renameSymbol(
  filePath: string,
  line: number,
  character: number,
  newName: string
): Promise<boolean> {
  if (!isTauriEnvironment()) return false;

  try {
    const edits = await ipc.lspRename(filePath, line, character, newName);

    if (edits && edits.length > 0) {
      console.log("Rename successful, edits:", edits);
      return true;
    }

    return false;
  } catch (e) {
    console.error("Rename failed:", e);
    return false;
  }
}
