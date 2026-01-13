/**
 * Peek View Component
 *
 * Shows a preview of code at a different location without navigating away.
 * Similar to VS Code's "Peek Definition" feature.
 */

import { createSignal, createEffect, Show, onCleanup } from "solid-js";
import { readFile } from "../../ipc/commands";
import type { LspLocation } from "../../ipc/commands";

interface PeekViewProps {
  visible: boolean;
  location: LspLocation | null;
  position: { x: number; y: number };
  onClose: () => void;
  onGotoLocation?: (location: LspLocation) => void;
}

export function PeekView(props: PeekViewProps) {
  const [content, setContent] = createSignal<string[]>([]);
  const [fileName, setFileName] = createSignal("");
  const [loading, setLoading] = createSignal(false);

  // Load file content when location changes
  createEffect(() => {
    if (props.visible && props.location) {
      loadContent();
    }
  });

  const loadContent = async () => {
    if (!props.location) return;

    setLoading(true);
    try {
      // Extract file path from URI
      const filePath = props.location.uri.replace("file://", "");
      setFileName(filePath.split("/").pop() || filePath);

      const result = await readFile(filePath);
      const lines = result.content.split("\n");

      // Get context around the target line (5 lines before and after)
      const startLine = Math.max(0, props.location.range.start.line - 5);
      const endLine = Math.min(lines.length, props.location.range.end.line + 6);

      setContent(lines.slice(startLine, endLine));
    } catch (e) {
      console.error("Failed to load peek content:", e);
      setContent(["// Failed to load file"]);
    } finally {
      setLoading(false);
    }
  };

  // Handle keyboard
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!props.visible) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      props.onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (props.location) {
        props.onGotoLocation?.(props.location);
      }
      props.onClose();
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

  const getStartLine = () => {
    if (!props.location) return 0;
    return Math.max(0, props.location.range.start.line - 5);
  };

  const isHighlightedLine = (index: number) => {
    if (!props.location) return false;
    const actualLine = getStartLine() + index;
    return (
      actualLine >= props.location.range.start.line &&
      actualLine <= props.location.range.end.line
    );
  };

  return (
    <Show when={props.visible && props.location}>
      <div
        class="fixed z-50 bg-bg-primary border border-accent/50 rounded-lg shadow-2xl overflow-hidden"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
          width: "600px",
          "max-height": "400px",
        }}
      >
        {/* Header */}
        <div class="flex items-center justify-between px-3 py-2 bg-accent/10 border-b border-border">
          <div class="flex items-center gap-2">
            <span class="text-accent text-sm">📄</span>
            <span class="text-text-primary text-sm font-medium">{fileName()}</span>
            <span class="text-text-tertiary text-xs">
              Line {(props.location?.range.start.line ?? 0) + 1}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <button
              class="text-text-secondary hover:text-text-primary text-xs px-2 py-1 rounded hover:bg-bg-hover transition-colors"
              onClick={() => {
                if (props.location) {
                  props.onGotoLocation?.(props.location);
                }
                props.onClose();
              }}
            >
              Go to →
            </button>
            <button
              class="text-text-tertiary hover:text-text-primary transition-colors"
              onClick={props.onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div class="overflow-auto max-h-80 font-mono text-sm">
          <Show when={loading()}>
            <div class="p-4 text-text-tertiary text-center">Loading...</div>
          </Show>
          <Show when={!loading()}>
            <div class="relative">
              {content().map((line, index) => (
                <div
                  class="flex"
                  classList={{
                    "bg-accent/10": isHighlightedLine(index),
                  }}
                >
                  {/* Line number */}
                  <span class="w-12 px-2 text-right text-text-tertiary select-none border-r border-border bg-bg-secondary">
                    {getStartLine() + index + 1}
                  </span>
                  {/* Code */}
                  <pre class="flex-1 px-3 py-0.5 text-text-primary overflow-x-auto">
                    {line || " "}
                  </pre>
                </div>
              ))}
            </div>
          </Show>
        </div>

        {/* Footer */}
        <div class="px-3 py-1.5 bg-bg-secondary border-t border-border text-xs text-text-tertiary flex items-center justify-between">
          <span>
            <kbd class="px-1 bg-bg-tertiary rounded">Enter</kbd> go to file
          </span>
          <span>
            <kbd class="px-1 bg-bg-tertiary rounded">Esc</kbd> close
          </span>
        </div>
      </div>
    </Show>
  );
}
