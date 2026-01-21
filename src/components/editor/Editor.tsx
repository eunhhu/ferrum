/**
 * Main Editor Component
 *
 * A high-performance code editor built with SolidJS.
 *
 * Features:
 * - Virtual scrolling for large files
 * - Syntax highlighting (tree-sitter in Tauri, regex fallback in browser)
 * - Multi-cursor support (planned)
 * - Undo/Redo with history
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
import * as ipc from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";
import { highlightCode } from "../../utils/clientHighlighter";
import { textMeasurer } from "../../utils/textMeasurer";
import {
  insertText,
  deleteBackwards,
  deleteRange,
} from "../../utils/editorHelpers";
import {
  EDITOR_CONFIG,
  LEFT_OFFSET,
  type EditorProps,
  type EditorState,
} from "./types";

const { LINE_HEIGHT, VISIBLE_LINE_BUFFER, GUTTER_WIDTH } = EDITOR_CONFIG;

export function Editor(props: EditorProps) {
  let containerRef: HTMLDivElement | undefined;
  let editorRef: HTMLDivElement | undefined;
  let textareaRef: HTMLTextAreaElement | undefined;

  // State - get initial content (captured once at component creation)
  const [state, setState] = createStore<EditorState>({
    // eslint-disable-next-line solid/reactivity -- intentional: capture initial content
    lines: props.content.split("\n"),
    cursor: { line: 0, column: 0, offset: 0 },
    selectionAnchor: null,
    isDragging: false,
    scrollTop: 0,
    scrollLeft: 0,
    highlights: [],
    compositionText: null,
  });

  const [isFocused, setIsFocused] = createSignal(false);

  // Derived values
  const totalLines = createMemo(() => state.lines.length);
  const contentHeight = createMemo(() => totalLines() * LINE_HEIGHT);

  const visibleRange = createMemo(() => {
    const startLine = Math.floor(state.scrollTop / LINE_HEIGHT);
    const containerHeight = containerRef?.clientHeight ?? 600;
    const endLine = Math.ceil(
      (state.scrollTop + containerHeight) / LINE_HEIGHT
    );

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
      if (isTauriEnvironment()) {
        const result = await ipc.getHighlights(props.bufferId);
        setState("highlights", result.highlights);
      } else {
        // Use client-side highlighting in browser mode
        const code = state.lines.join("\n");
        const highlights = highlightCode(code, props.language || "typescript");
        setState("highlights", highlights);
      }
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
    // If composing, do nothing (wait for compositionEnd)
    if (state.compositionText !== null && e.inputType === "insertText") {
      return;
    }

    const target = e.target as HTMLTextAreaElement;
    if (e.inputType === "insertText" && e.data) {
      applyEdit(e.data);
      target.value = "";
    } else if (e.inputType === "insertLineBreak") {
      applyEdit("\n");
      target.value = "";
    } else if (e.inputType === "deleteContentBackward") {
      applyBackspace();
    }
  }

  function handleCompositionStart() {
    setState("compositionText", "");
  }

  function handleCompositionUpdate(e: CompositionEvent) {
    setState("compositionText", e.data);
  }

  function handleCompositionEnd(e: CompositionEvent) {
    const text = e.data;
    setState("compositionText", null);
    if (text) {
      applyEdit(text);
    }
    if (textareaRef) textareaRef.value = "";
  }

  function applyEdit(text: string) {
    batch(() => {
      let currentLines = state.lines;
      let startLine = state.cursor.line;
      let startCol = state.cursor.column;

      // If selection exists, delete it first
      if (state.selectionAnchor) {
        const { newLines, endLine, endColumn } = deleteRange(
          currentLines,
          state.selectionAnchor.line,
          state.selectionAnchor.column,
          state.cursor.line,
          state.cursor.column
        );
        currentLines = newLines;
        startLine = endLine;
        startCol = endColumn;
        setState("selectionAnchor", null); // Clear selection
      }

      const { newLines, endLine, endColumn } = insertText(
        currentLines,
        text,
        startLine,
        startCol
      );
      setState("lines", newLines);
      setState("cursor", { line: endLine, column: endColumn, offset: 0 });
      props.onContentChange?.(newLines.join("\n"));
      scheduleHighlightUpdate();
    });
    // Auto-scroll to keep cursor visible
    setTimeout(ensureCursorVisible, 0);
  }

  function applyBackspace() {
    batch(() => {
      let newLines = state.lines;
      let endLine = state.cursor.line;
      let endColumn = state.cursor.column;

      if (state.selectionAnchor) {
        // Delete selection
        const result = deleteRange(
          state.lines,
          state.selectionAnchor.line,
          state.selectionAnchor.column,
          state.cursor.line,
          state.cursor.column
        );
        newLines = result.newLines;
        endLine = result.endLine;
        endColumn = result.endColumn;
        setState("selectionAnchor", null);
      } else {
        // Normal backspace
        const result = deleteBackwards(
          state.lines,
          state.cursor.line,
          state.cursor.column
        );
        newLines = result.newLines;
        endLine = result.endLine;
        endColumn = result.endColumn;
      }

      setState("lines", newLines);
      setState("cursor", { line: endLine, column: endColumn, offset: 0 });
      props.onContentChange?.(newLines.join("\n"));
      scheduleHighlightUpdate();
    });
  }

  // Handle key events
  function handleKeyDown(e: KeyboardEvent) {
    // Undo/Redo
    if (e.metaKey || e.ctrlKey) {
      if (e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      applyBackspace();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      applyEdit("\n");
      return;
    }

    // Arrow key navigation
    if (
      [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ].includes(e.key)
    ) {
      handleNavigation(e.key, e.shiftKey);
      // e.preventDefault(); // Prevent scrolling if needed, but let's keep default for now
    }
  }

  function handleNavigation(key: string, shiftKey: boolean) {
    let { line, column } = state.cursor;

    // If shift is pressed but no anchor, set anchor to current cursor
    if (shiftKey && !state.selectionAnchor) {
      setState("selectionAnchor", { ...state.cursor });
    }

    // If shift is NOT pressed but we have selection, clear anchor
    // Unless logic requires jumping to start/end of selection (VSCode style)
    // For now, simpler logic: clear selection on move without shift
    if (!shiftKey && state.selectionAnchor) {
      setState("selectionAnchor", null);
      // TODO: Ideally, Left arrow should go to selection start, Right to end.
      // Keeping it simple: collapse to cursor for now, or let cursor move naturally
    }

    switch (key) {
      case "ArrowLeft":
        if (column > 0) column--;
        else if (line > 0) {
          line--;
          column = state.lines[line]?.length ?? 0;
        }
        break;
      case "ArrowRight":
        if (column < (state.lines[line]?.length ?? 0)) column++;
        else if (line < state.lines.length - 1) {
          line++;
          column = 0;
        }
        break;
      case "ArrowUp":
        if (line > 0) {
          line--;
          column = Math.min(column, state.lines[line]?.length ?? 0);
        }
        break;
      case "ArrowDown":
        if (line < state.lines.length - 1) {
          line++;
          column = Math.min(column, state.lines[line]?.length ?? 0);
        }
        break;
      case "Home":
        column = 0;
        break;
      case "End":
        column = state.lines[line]?.length ?? 0;
        break;
    }

    batch(() => {
      setState("cursor", { line, column, offset: 0 });
      // Update hidden input position
      updateHiddenInputPosition();
    });

    // Auto-scroll to keep cursor visible when navigating with keyboard
    setTimeout(ensureCursorVisible, 0);

    props.onCursorChange?.(line + 1, column + 1);
  }

  // Calculate selection rects for rendering
  const selectionRects = createMemo(() => {
    if (!state.selectionAnchor) return [];

    let start = state.selectionAnchor;
    let end = state.cursor;

    // Sort start/end
    if (
      start.line > end.line ||
      (start.line === end.line && start.column > end.column)
    ) {
      [start, end] = [end, start];
    }

    const rects: {
      top: number;
      left: number;
      width: number;
      height: number;
    }[] = [];
    textMeasurer.setFont(
      "13px 'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace"
    );

    for (let line = start.line; line <= end.line; line++) {
      if (line >= state.lines.length) break;
      const lineContent = state.lines[line] ?? "";

      const startCol = line === start.line ? start.column : 0;
      const endCol = line === end.line ? end.column : lineContent.length;

      const startX = textMeasurer.measure(lineContent.substring(0, startCol));
      let width = textMeasurer.measure(lineContent.substring(startCol, endCol));

      // Add padding for newline selection if not at EOF
      if (
        line !== end.line ||
        (endCol === lineContent.length && line < state.lines.length - 1)
      ) {
        width += 7.85;
      }

      rects.push({
        top: line * LINE_HEIGHT,
        left: LEFT_OFFSET + startX,
        width: Math.max(width, 4), // Min width for empty lines
        height: LINE_HEIGHT,
      });
    }
    return rects;
  });

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

  // Handle scroll
  function handleScroll(e: Event) {
    const target = e.target as HTMLDivElement;
    const scrollTop = target.scrollTop;
    const visibleStartLine = Math.floor(scrollTop / LINE_HEIGHT);

    batch(() => {
      setState("scrollTop", scrollTop);
      setState("scrollLeft", target.scrollLeft);
    });

    // Notify parent of scroll change
    props.onScrollChange?.(scrollTop, visibleStartLine);
  }

  // Scroll to a specific line (used by sticky header click)
  function scrollToLine(line: number) {
    if (!editorRef) return;
    const targetScrollTop = Math.max(0, line * LINE_HEIGHT);
    editorRef.scrollTop = targetScrollTop;
  }

  // Ensure cursor is visible (auto-scroll when cursor moves out of view)
  function ensureCursorVisible() {
    if (!editorRef || !containerRef) return;

    const cursorTop = state.cursor.line * LINE_HEIGHT;
    const cursorBottom = cursorTop + LINE_HEIGHT;
    const viewportTop = state.scrollTop;
    const viewportBottom = state.scrollTop + containerRef.clientHeight;

    // Scroll up if cursor is above viewport
    if (cursorTop < viewportTop) {
      editorRef.scrollTop = cursorTop;
    }
    // Scroll down if cursor is below viewport
    else if (cursorBottom > viewportBottom) {
      editorRef.scrollTop = cursorBottom - containerRef.clientHeight;
    }
  }

  // Expose scrollToLine for parent components via window
  if (typeof window !== "undefined") {
    (
      window as { __ferrum_editor_scrollToLine?: typeof scrollToLine }
    ).__ferrum_editor_scrollToLine = scrollToLine;
  }

  // Calculate cursor position from mouse event
  function getCursorFromEvent(e: MouseEvent): { line: number; column: number } {
    if (!editorRef) return { line: 0, column: 0 };

    const rect = editorRef.getBoundingClientRect();
    const x = e.clientX - rect.left - LEFT_OFFSET + state.scrollLeft;
    const y = e.clientY - rect.top + state.scrollTop;

    // Calculate line index
    const lineIndex = Math.floor(y / LINE_HEIGHT);
    const safeLineIndex = Math.max(
      0,
      Math.min(lineIndex, state.lines.length - 1)
    );

    // Calculate column index by measuring text
    const lineContent = state.lines[safeLineIndex] ?? "";
    textMeasurer.setFont(
      "13px 'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace"
    );
    const columnIndex = textMeasurer.measureCursorIndex(lineContent, x);

    return { line: safeLineIndex, column: columnIndex };
  }

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return; // Only left click

    const { line, column } = getCursorFromEvent(e);

    batch(() => {
      setState("cursor", { line, column, offset: 0 });
      setState("selectionAnchor", { line, column, offset: 0 }); // Start selection
      setState("isDragging", true);
      setIsFocused(true);
    });

    // Capture mouse for drag
    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);

    updateHiddenInputPosition();
    textareaRef?.focus();
    props.onCursorChange?.(line + 1, column + 1);
  }

  function handleWindowMouseMove(e: MouseEvent) {
    if (!state.isDragging) return;

    const { line, column } = getCursorFromEvent(e);

    // If cursor changed, update it
    if (line !== state.cursor.line || column !== state.cursor.column) {
      batch(() => {
        setState("cursor", { line, column, offset: 0 });
      });
      props.onCursorChange?.(line + 1, column + 1);
    }
  }

  function handleWindowMouseUp() {
    setState("isDragging", false);
    // If anchor equals cursor, clear selection (handled by rendering logic or explicitly)
    if (
      state.selectionAnchor &&
      state.selectionAnchor.line === state.cursor.line &&
      state.selectionAnchor.column === state.cursor.column
    ) {
      setState("selectionAnchor", null);
    }

    window.removeEventListener("mousemove", handleWindowMouseMove);
    window.removeEventListener("mouseup", handleWindowMouseUp);
    textareaRef?.focus();
  }

  // Calculate cursor visual X position

  // Calculate cursor visual X position
  const cursorLeft = createMemo(() => {
    const lineContent = state.lines[state.cursor.line] || "";
    textMeasurer.setFont(
      "13px 'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace"
    );
    const textBeforeCursor = lineContent.substring(0, state.cursor.column);
    let width = textMeasurer.measure(textBeforeCursor);

    // Add width of composition text if it exists
    if (state.compositionText) {
      width += textMeasurer.measure(state.compositionText);
    }
    return width;
  });

  function updateHiddenInputPosition() {
    if (!textareaRef) return;
    // Position hidden input near cursor for IME support
    // Logic will be handled in render via style binding
  }

  // Render highlighted line
  function renderLine(content: string, lineNumber: number): JSX.Element {
    // IF composing on this line, render modified content without highlights (simpler)
    if (lineNumber === state.cursor.line && state.compositionText) {
      const col = state.cursor.column;
      const before = content.substring(0, col);
      const after = content.substring(col);
      return (
        <>
          <span>{before}</span>
          <span class="underline decoration-blue-500">
            {state.compositionText}
          </span>
          <span>{after}</span>
        </>
      );
    }

    // Find highlights for this line
    const lineStart = state.lines
      .slice(0, lineNumber)
      .reduce((sum, l) => sum + l.length + 1, 0);
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

      spans.push(<span class={h.css_class}>{content.slice(start, end)}</span>);
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
      class="editor-container relative h-full w-full font-mono text-sm bg-bg-primary overflow-hidden cursor-text"
      onMouseDown={handleMouseDown}
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
          {/* Selection Layer - Behind text */}
          <For each={selectionRects()}>
            {(rect) => (
              <div
                class="absolute bg-blue-500/30 pointer-events-none"
                style={{
                  top: `${rect.top}px`,
                  left: `${rect.left}px`,
                  width: `${rect.width}px`,
                  height: `${rect.height}px`,
                }}
              />
            )}
          </For>

          {/* Gutter (line numbers) */}
          <div
            class="absolute left-0 top-0 bg-bg-secondary text-text-tertiary text-right select-none border-r border-gray-800 z-10"
            style={{
              height: `${contentHeight()}px`,
              width: `${GUTTER_WIDTH}px`,
            }}
          >
            <For each={visibleLines()}>
              {(line) => (
                <div
                  class="leading-5 pr-3"
                  style={{
                    position: "absolute",
                    top: `${line.number * LINE_HEIGHT}px`,
                    height: `${LINE_HEIGHT}px`,
                    width: `${GUTTER_WIDTH}px`,
                    "line-height": `${LINE_HEIGHT}px`,
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
          <div class="cursor-text">
            <For each={visibleLines()}>
              {(line) => (
                <div
                  class="whitespace-pre"
                  style={{
                    position: "absolute",
                    top: `${line.number * LINE_HEIGHT}px`,
                    left: `${LEFT_OFFSET}px`,
                    height: `${LINE_HEIGHT}px`,
                    "line-height": `${LINE_HEIGHT}px`,
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
              class="absolute w-0.5 bg-blue-500 animate-pulse pointer-events-none"
              style={{
                top: `${state.cursor.line * LINE_HEIGHT}px`,
                left: `${LEFT_OFFSET + cursorLeft()}px`,
                height: `${LINE_HEIGHT}px`,
              }}
            />
          </Show>
        </div>
      </div>

      {/* Hidden textarea for input handling - positioned near cursor for IME */}
      <textarea
        ref={textareaRef}
        class="absolute w-1 h-1 opacity-0 p-0 m-0 border-0 pointer-events-none"
        style={{
          top: `${Math.max(0, state.cursor.line * LINE_HEIGHT - state.scrollTop)}px`,
          left: `${LEFT_OFFSET + cursorLeft() - state.scrollLeft}px`,
          "z-index": "-1",
        }}
        value=""
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionUpdate={handleCompositionUpdate}
        onCompositionEnd={handleCompositionEnd}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        spellcheck={false}
        autocomplete="off"
        autocapitalize="off"
      />
    </div>
  );
}
