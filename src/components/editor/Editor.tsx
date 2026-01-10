/**
 * Main Editor Component
 *
 * Implements a high-performance code editor using fine-grained SolidJS signals.
 * Key optimizations:
 * - Virtual scrolling for large files
 * - GPU-accelerated cursor and selection layers
 * - Debounced syntax highlighting
 * - Optimistic updates for typing
 */

import {
  createSignal,
  createEffect,
  createMemo,
  For,
  Show,
  onMount,
  onCleanup,
  batch,
  type JSX,
} from "solid-js";
import { createStore } from "solid-js/store";
import type { HighlightSpan } from "../../ipc/types";
import * as ipc from "../../ipc/commands";

// Constants
const LINE_HEIGHT = 20; // pixels
const CHAR_WIDTH = 8.4; // approximate for monospace font
const VISIBLE_LINE_BUFFER = 5; // Extra lines to render above/below viewport

interface EditorProps {
  bufferId: string;
  content: string;
  language?: string;
  onContentChange?: (content: string) => void;
  onCursorChange?: (line: number, column: number) => void;
}

interface Cursor {
  line: number;
  column: number;
  offset: number;
}

interface Selection {
  start: Cursor;
  end: Cursor;
  direction: "forward" | "backward";
}

interface EditorState {
  lines: string[];
  cursor: Cursor;
  selection: Selection | null;
  scrollTop: number;
  scrollLeft: number;
  highlights: HighlightSpan[];
}

export function Editor(props: EditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let editorRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;

  // State
  const [state, setState] = createStore<EditorState>({
    lines: props.content.split("\n"),
    cursor: { line: 0, column: 0, offset: 0 },
    selection: null,
    scrollTop: 0,
    scrollLeft: 0,
    highlights: [],
  });

  const [isFocused, setIsFocused] = createSignal(false);

  // Derived values
  const totalLines = createMemo(() => state.lines.length);
  const contentHeight = createMemo(() => totalLines() * LINE_HEIGHT);

  const visibleRange = createMemo(() => {
    const startLine = Math.floor(state.scrollTop / LINE_HEIGHT);
    const containerHeight = containerRef?.clientHeight ?? 600;
    const endLine = Math.ceil((state.scrollTop + containerHeight) / LINE_HEIGHT);

    return {
      start: Math.max(0, startLine - VISIBLE_LINE_BUFFER),
      end: Math.min(totalLines(), endLine + VISIBLE_LINE_BUFFER),
    };
  });

  const visibleLines = createMemo(() => {
    const range = visibleRange();
    return state.lines.slice(range.start, range.end).map((content, i) => ({
      number: range.start + i,
      content,
    }));
  });

  // Load syntax highlights
  async function loadHighlights() {
    if (!props.bufferId) return;

    try {
      const result = await ipc.getHighlights(props.bufferId);
      setState("highlights", result.highlights);
    } catch (e) {
      console.error("Failed to load highlights:", e);
    }
  }

  // Debounced highlight loading
  let highlightTimeout: ReturnType<typeof setTimeout>;
  function scheduleHighlightUpdate() {
    clearTimeout(highlightTimeout);
    highlightTimeout = setTimeout(loadHighlights, 100);
  }

  // Update content from props
  createEffect(() => {
    const lines = props.content.split("\n");
    setState("lines", lines);
    scheduleHighlightUpdate();
  });

  // Handle text input
  function handleInput(e: InputEvent) {
    const target = e.target as HTMLTextAreaElement;
    const newContent = target.value;

    batch(() => {
      setState("lines", newContent.split("\n"));
      updateCursorFromTextarea();
    });

    props.onContentChange?.(newContent);
    scheduleHighlightUpdate();
  }

  // Handle key events
  function handleKeyDown(e: KeyboardEvent) {
    // Undo/Redo
    if (e.metaKey || e.ctrlKey) {
      if (e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
    }

    // Arrow key navigation updates cursor position
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      // Let default behavior happen, then update cursor
      setTimeout(updateCursorFromTextarea, 0);
    }
  }

  async function handleUndo() {
    if (!props.bufferId) return;
    try {
      const result = await ipc.bufferUndo(props.bufferId);
      setState("lines", result.content.split("\n"));
      props.onContentChange?.(result.content);
    } catch (e) {
      console.error("Undo failed:", e);
    }
  }

  async function handleRedo() {
    if (!props.bufferId) return;
    try {
      const result = await ipc.bufferRedo(props.bufferId);
      setState("lines", result.content.split("\n"));
      props.onContentChange?.(result.content);
    } catch (e) {
      console.error("Redo failed:", e);
    }
  }

  function updateCursorFromTextarea() {
    if (!textareaRef) return;

    const pos = textareaRef.selectionStart;
    const content = textareaRef.value;

    // Calculate line and column
    let line = 0;
    let column = 0;
    let offset = 0;

    for (let i = 0; i < pos; i++) {
      if (content[i] === "\n") {
        line++;
        column = 0;
      } else {
        column++;
      }
      offset++;
    }

    batch(() => {
      setState("cursor", { line, column, offset });
    });

    props.onCursorChange?.(line + 1, column + 1);
  }

  // Handle scroll
  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    batch(() => {
      setState("scrollTop", target.scrollTop);
      setState("scrollLeft", target.scrollLeft);
    });
  }

  // Handle click
  function handleClick() {
    textareaRef?.focus();
    setTimeout(updateCursorFromTextarea, 0);
  }

  // Render highlighted line
  function renderLine(content: string, lineNumber: number): JSX.Element {
    // Find highlights for this line
    const lineStart = state.lines.slice(0, lineNumber).reduce((sum, l) => sum + l.length + 1, 0);
    const lineEnd = lineStart + content.length;

    const lineHighlights = state.highlights.filter(
      (h) => h.start < lineEnd && h.end > lineStart
    );

    if (lineHighlights.length === 0) {
      return <span>{content || " "}</span>;
    }

    // Build spans with highlights
    const spans: JSX.Element[] = [];
    let lastEnd = lineStart;

    for (const h of lineHighlights.sort((a, b) => a.start - b.start)) {
      const start = Math.max(h.start - lineStart, 0);
      const end = Math.min(h.end - lineStart, content.length);

      if (start > lastEnd - lineStart) {
        spans.push(<span>{content.slice(lastEnd - lineStart, start)}</span>);
      }

      spans.push(
        <span class={h.css_class}>{content.slice(start, end)}</span>
      );
      lastEnd = lineStart + end;
    }

    if (lastEnd - lineStart < content.length) {
      spans.push(<span>{content.slice(lastEnd - lineStart)}</span>);
    }

    return <>{spans.length > 0 ? spans : <span>{content || " "}</span>}</>;
  }

  // Mount
  onMount(() => {
    loadHighlights();
  });

  onCleanup(() => {
    clearTimeout(highlightTimeout);
  });

  return (
    <div
      ref={containerRef}
      class="editor-container relative h-full w-full font-mono text-sm bg-bg-primary overflow-hidden"
      onClick={handleClick}
    >
      {/* Scrollable viewport */}
      <div
        ref={editorRef}
        class="absolute inset-0 overflow-auto"
        onScroll={handleScroll}
      >
        {/* Content container with total height */}
        <div
          class="relative"
          style={{ height: `${contentHeight()}px`, "min-width": "100%" }}
        >
          {/* Gutter (line numbers) */}
          <div
            class="absolute left-0 top-0 w-12 bg-bg-secondary text-text-tertiary text-right pr-2 select-none"
            style={{ height: `${contentHeight()}px` }}
          >
            <For each={visibleLines()}>
              {(line) => (
                <div
                  class="h-5 leading-5"
                  style={{
                    position: "absolute",
                    top: `${line.number * LINE_HEIGHT}px`,
                  }}
                  classList={{
                    "text-text-primary": line.number === state.cursor.line,
                  }}
                >
                  {line.number + 1}
                </div>
              )}
            </For>
          </div>

          {/* Editor content */}
          <div class="ml-12 pl-4">
            <For each={visibleLines()}>
              {(line) => (
                <div
                  class="h-5 leading-5 whitespace-pre"
                  style={{
                    position: "absolute",
                    top: `${line.number * LINE_HEIGHT}px`,
                    left: "52px", // 12 (gutter) + 4 (padding)
                  }}
                  classList={{
                    "bg-accent-primary/5": line.number === state.cursor.line,
                  }}
                >
                  {renderLine(line.content, line.number)}
                </div>
              )}
            </For>
          </div>

          {/* Cursor layer */}
          <Show when={isFocused()}>
            <div
              class="absolute w-0.5 bg-accent-primary animate-blink pointer-events-none"
              style={{
                top: `${state.cursor.line * LINE_HEIGHT}px`,
                left: `${52 + state.cursor.column * CHAR_WIDTH}px`,
                height: `${LINE_HEIGHT}px`,
              }}
            />
          </Show>
        </div>
      </div>

      {/* Hidden textarea for input handling */}
      <textarea
        ref={textareaRef}
        class="absolute opacity-0 w-0 h-0"
        value={state.lines.join("\n")}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        spellcheck={false}
        autocomplete="off"
        autocapitalize="off"
      />
    </div>
  );
}
