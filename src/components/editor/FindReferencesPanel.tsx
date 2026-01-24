/**
 * Find References Panel Component
 *
 * Displays all references to a symbol found by LSP.
 * Shows file locations with preview snippets.
 */

import { createSignal, For, Show } from "solid-js";
import type { LspLocation } from "../../ipc/commands";
import * as ipc from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";
import { editorStore } from "../../stores";

interface FindReferencesPanelProps {
  visible: boolean;
  symbolName: string;
  references: LspLocation[];
  position: { x: number; y: number };
  onClose: () => void;
  onNavigate?: (location: LspLocation) => void;
}

interface ReferenceWithPreview {
  location: LspLocation;
  preview: string;
  fileName: string;
}

export function FindReferencesPanel(props: FindReferencesPanelProps) {
  const [referencesWithPreview, setReferencesWithPreview] = createSignal<ReferenceWithPreview[]>(
    []
  );
  const [loading, setLoading] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  // Load preview content for each reference
  const loadPreviews = async () => {
    if (!isTauriEnvironment()) {
      setReferencesWithPreview(
        props.references.map((loc) => ({
          location: loc,
          preview: "Preview not available",
          fileName: loc.uri.split("/").pop() || loc.uri,
        }))
      );
      return;
    }

    setLoading(true);
    const results: ReferenceWithPreview[] = [];

    for (const ref of props.references) {
      const filePath = ref.uri.replace("file://", "");
      const fileName = filePath.split("/").pop() || filePath;

      try {
        const content = await ipc.readFile(filePath);
        const lines = content.content.split("\n");
        const lineNum = ref.range.start.line;
        const preview = lines[lineNum]?.trim() || "";

        results.push({
          location: ref,
          preview,
          fileName,
        });
      } catch {
        results.push({
          location: ref,
          preview: "Could not load preview",
          fileName,
        });
      }
    }

    setReferencesWithPreview(results);
    setLoading(false);
  };

  // Load previews when references change
  if (props.visible && props.references.length > 0) {
    loadPreviews();
  }

  const handleNavigate = (ref: ReferenceWithPreview) => {
    const filePath = ref.location.uri.replace("file://", "");
    editorStore.openFileWithBuffer(filePath);
    props.onNavigate?.(ref.location);
    props.onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, referencesWithPreview().length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter": {
        e.preventDefault();
        const selected = referencesWithPreview()[selectedIndex()];
        if (selected) handleNavigate(selected);
        break;
      }
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  };

  return (
    <Show when={props.visible}>
      <div
        class="absolute z-50 bg-bg-secondary border border-border rounded-lg shadow-xl overflow-hidden"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
          width: "500px",
          "max-height": "400px",
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* Header */}
        <div class="px-3 py-2 border-b border-border flex items-center justify-between bg-bg-tertiary">
          <div class="flex items-center gap-2">
            <svg class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
            <span class="text-sm font-medium text-text-primary">
              References: <span class="text-accent">{props.symbolName}</span>
            </span>
            <span class="text-xs text-text-tertiary">({props.references.length} found)</span>
          </div>
          <button
            class="p-1 hover:bg-bg-hover rounded transition-colors"
            onClick={props.onClose}
            title="Close"
          >
            <svg class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div class="overflow-auto" style={{ "max-height": "350px" }}>
          <Show when={loading()}>
            <div class="flex items-center justify-center py-8">
              <div class="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span class="ml-2 text-text-secondary text-sm">Loading references...</span>
            </div>
          </Show>

          <Show when={!loading() && referencesWithPreview().length === 0}>
            <div class="py-8 text-center text-text-tertiary text-sm">No references found</div>
          </Show>

          <Show when={!loading() && referencesWithPreview().length > 0}>
            <For each={referencesWithPreview()}>
              {(ref, index) => (
                <button
                  class="w-full text-left px-3 py-2 hover:bg-bg-hover transition-colors border-b border-border/50 last:border-0"
                  classList={{
                    "bg-accent/10": index() === selectedIndex(),
                  }}
                  onClick={() => handleNavigate(ref)}
                  onMouseEnter={() => setSelectedIndex(index())}
                >
                  <div class="flex items-center gap-2 mb-1">
                    <svg
                      class="w-3.5 h-3.5 text-text-tertiary"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                    </svg>
                    <span class="text-sm text-text-primary font-medium">{ref.fileName}</span>
                    <span class="text-xs text-text-tertiary">
                      :{ref.location.range.start.line + 1}:{ref.location.range.start.character + 1}
                    </span>
                  </div>
                  <div class="font-mono text-xs text-text-secondary truncate pl-5">
                    {ref.preview}
                  </div>
                </button>
              )}
            </For>
          </Show>
        </div>

        {/* Footer */}
        <div class="px-3 py-1.5 border-t border-border bg-bg-tertiary text-xs text-text-tertiary">
          <span class="mr-3">↑↓ Navigate</span>
          <span class="mr-3">↵ Open</span>
          <span>Esc Close</span>
        </div>
      </div>
    </Show>
  );
}

// Helper function to find references
export async function findReferences(
  filePath: string,
  line: number,
  character: number
): Promise<LspLocation[]> {
  if (!isTauriEnvironment()) return [];

  try {
    const refs = await ipc.lspReferences(filePath, line, character, true);
    return refs;
  } catch (e) {
    console.error("Find references failed:", e);
    return [];
  }
}
