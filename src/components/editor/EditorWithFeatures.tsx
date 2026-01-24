/**
 * Editor With Features Component
 *
 * Integrates the core Editor with:
 * - Hover Tooltip (LSP hover info)
 * - Autocomplete dropdown (LSP completions)
 * - Context Action Palette (right-click menu)
 * - Peek View (inline definition preview)
 */

import { createEffect, createSignal, onCleanup, Show } from "solid-js";
import * as ipc from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";
import { textMeasurer } from "../../utils/textMeasurer";
import { Autocomplete } from "./Autocomplete";
import { ContextActionPalette } from "./ContextActionPalette";
import { Editor } from "./Editor";
import { HoverTooltip } from "./HoverTooltip";
import { PeekView } from "./PeekView";
import { EDITOR_CONFIG, type EditorProps, LEFT_OFFSET } from "./types";

const { LINE_HEIGHT } = EDITOR_CONFIG;

interface EditorWithFeaturesProps extends EditorProps {
  filePath?: string;
}

export function EditorWithFeatures(props: EditorWithFeaturesProps) {
  let containerRef: HTMLDivElement | undefined;

  // Cursor and selection state
  const [cursorLine, setCursorLine] = createSignal(0);
  const [cursorColumn, setCursorColumn] = createSignal(0);
  const [scrollTop, setScrollTop] = createSignal(0);
  const [scrollLeft] = createSignal(0);
  const [selectedText, setSelectedText] = createSignal("");

  // Hover tooltip state
  const [hoverVisible, setHoverVisible] = createSignal(false);
  const [hoverContent, setHoverContent] = createSignal<string | null>(null);
  const [hoverPosition, setHoverPosition] = createSignal({ x: 0, y: 0 });

  // Autocomplete state
  const [autocompleteVisible, setAutocompleteVisible] = createSignal(false);
  const [autocompleteItems, setAutocompleteItems] = createSignal<ipc.LspCompletionItem[]>([]);
  const [autocompletePosition, setAutocompletePosition] = createSignal({
    x: 0,
    y: 0,
  });

  // Context action palette state
  const [contextMenuVisible, setContextMenuVisible] = createSignal(false);
  const [contextMenuPosition, setContextMenuPosition] = createSignal({
    x: 0,
    y: 0,
  });

  // Peek view state
  const [peekVisible, setPeekVisible] = createSignal(false);
  const [peekLocation, setPeekLocation] = createSignal<ipc.LspLocation | null>(null);
  const [peekPosition, setPeekPosition] = createSignal({ x: 100, y: 100 });

  // Content for selection tracking
  const [content, setContent] = createSignal(props.content);

  // Debounce timers
  let hoverDebounceTimer: ReturnType<typeof setTimeout>;
  let autocompleteDebounceTimer: ReturnType<typeof setTimeout>;

  // Update content when props change
  createEffect(() => {
    setContent(props.content);
  });

  // Handle cursor change from editor
  function handleCursorChange(line: number, column: number) {
    setCursorLine(line - 1); // Convert to 0-indexed
    setCursorColumn(column - 1);
    props.onCursorChange?.(line, column);

    // Hide hover when cursor moves
    setHoverVisible(false);
  }

  // Handle scroll change from editor
  function handleScrollChange(newScrollTop: number, visibleStartLine: number) {
    setScrollTop(newScrollTop);
    props.onScrollChange?.(newScrollTop, visibleStartLine);

    // Hide popups on scroll
    setHoverVisible(false);
    setAutocompleteVisible(false);
  }

  // Handle content change from editor
  function handleContentChange(newContent: string) {
    setContent(newContent);
    props.onContentChange?.(newContent);

    // Trigger autocomplete on certain characters
    const lines = newContent.split("\n");
    const currentLine = lines[cursorLine()] || "";
    const charBeforeCursor = currentLine[cursorColumn() - 1] || "";

    // Trigger autocomplete on . or typing
    if (charBeforeCursor === "." || charBeforeCursor === "(" || /[a-zA-Z]/.test(charBeforeCursor)) {
      scheduleAutocomplete();
    } else {
      setAutocompleteVisible(false);
    }
  }

  // Schedule hover info fetch
  function scheduleHoverFetch(line: number, column: number, x: number, y: number) {
    clearTimeout(hoverDebounceTimer);
    hoverDebounceTimer = setTimeout(async () => {
      await fetchHoverInfo(line, column, x, y);
    }, 300);
  }

  // Fetch hover info from LSP
  async function fetchHoverInfo(line: number, column: number, x: number, y: number) {
    if (!(props.filePath && isTauriEnvironment())) return;

    try {
      const result = await ipc.lspHover(props.filePath, line, column);
      if (result && result.contents) {
        setHoverContent(result.contents);
        setHoverPosition({ x, y: y + LINE_HEIGHT });
        setHoverVisible(true);
      } else {
        setHoverVisible(false);
      }
    } catch (e) {
      console.error("Hover fetch failed:", e);
      setHoverVisible(false);
    }
  }

  // Schedule autocomplete fetch
  function scheduleAutocomplete() {
    clearTimeout(autocompleteDebounceTimer);
    autocompleteDebounceTimer = setTimeout(async () => {
      await fetchAutocomplete();
    }, 100);
  }

  // Fetch autocomplete from LSP
  async function fetchAutocomplete() {
    if (!(props.filePath && isTauriEnvironment())) return;

    try {
      const items = await ipc.lspCompletion(props.filePath, cursorLine(), cursorColumn());

      if (items && items.length > 0) {
        setAutocompleteItems(items);

        // Calculate position
        const lines = content().split("\n");
        const currentLine = lines[cursorLine()] || "";
        textMeasurer.setFont(`${EDITOR_CONFIG.FONT_SIZE}px ${EDITOR_CONFIG.FONT_FAMILY}`);
        const textWidth = textMeasurer.measure(currentLine.substring(0, cursorColumn()));

        setAutocompletePosition({
          x: LEFT_OFFSET + textWidth - scrollLeft(),
          y: (cursorLine() + 1) * LINE_HEIGHT - scrollTop(),
        });
        setAutocompleteVisible(true);
      } else {
        setAutocompleteVisible(false);
      }
    } catch (e) {
      console.error("Autocomplete fetch failed:", e);
      setAutocompleteVisible(false);
    }
  }

  // Handle autocomplete selection
  function handleAutocompleteSelect(item: ipc.LspCompletionItem) {
    setAutocompleteVisible(false);

    // Insert the completion text
    const insertText = item.insert_text || item.label;
    const lines = content().split("\n");
    const currentLine = lines[cursorLine()] || "";

    // Find the word start position
    let wordStart = cursorColumn();
    while (wordStart > 0 && /[a-zA-Z0-9_$]/.test(currentLine[wordStart - 1] || "")) {
      wordStart--;
    }

    // Replace the current word with completion
    const before = currentLine.substring(0, wordStart);
    const after = currentLine.substring(cursorColumn());
    lines[cursorLine()] = before + insertText + after;

    const newContent = lines.join("\n");
    setContent(newContent);
    props.onContentChange?.(newContent);
  }

  // Handle mouse move for hover
  function handleMouseMove(e: MouseEvent) {
    if (!containerRef) return;

    const rect = containerRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + scrollTop();

    // Calculate line and column from position
    const line = Math.floor(y / LINE_HEIGHT);
    const lines = content().split("\n");

    if (line < 0 || line >= lines.length) {
      setHoverVisible(false);
      return;
    }

    const lineContent = lines[line] || "";
    textMeasurer.setFont(`${EDITOR_CONFIG.FONT_SIZE}px ${EDITOR_CONFIG.FONT_FAMILY}`);
    const column = textMeasurer.measureCursorIndex(lineContent, x - LEFT_OFFSET + scrollLeft());

    // Only fetch hover if on a word character
    const char = lineContent[column] || "";
    if (/[a-zA-Z0-9_$]/.test(char)) {
      scheduleHoverFetch(line, column, e.clientX - rect.left, e.clientY - rect.top);
    } else {
      clearTimeout(hoverDebounceTimer);
      setHoverVisible(false);
    }
  }

  // Handle mouse leave
  function handleMouseLeave() {
    clearTimeout(hoverDebounceTimer);
    setHoverVisible(false);
  }

  // Handle right-click for context menu
  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();

    if (!containerRef) return;

    const rect = containerRef.getBoundingClientRect();

    // Get selection info
    const selection = window.getSelection();
    const selText = selection?.toString() || "";
    setSelectedText(selText);

    // Position context menu at mouse location
    setContextMenuPosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setContextMenuVisible(true);
  }

  // Handle context menu close
  function handleContextMenuClose() {
    setContextMenuVisible(false);
  }

  // Handle goto location from context menu
  function handleGotoLocation(location: ipc.LspLocation) {
    // Show in peek view at a reasonable position
    setPeekLocation(location);
    setPeekPosition({
      x: Math.min(contextMenuPosition().x, 200),
      y: Math.min(contextMenuPosition().y + 20, 150),
    });
    setPeekVisible(true);
    setContextMenuVisible(false);
  }

  // Handle selection change from context menu
  function handleSelectionChange(
    startLine: number,
    startChar: number,
    endLine: number,
    endChar: number
  ) {
    // This would need to communicate back to the Editor component
    // For now, log it
    console.log("Selection change:", {
      startLine,
      startChar,
      endLine,
      endChar,
    });
  }

  // Handle showing AI panel
  function handleShowAiPanel(action: string, code: string, error?: string) {
    // This would open the AI panel with the given action
    console.log("Show AI panel:", { action, code, error });
  }

  // Calculate byte offsets for selection
  function getSelectionBytes(): { start: number; end: number } {
    const lines = content().split("\n");
    let startByte = 0;

    for (let i = 0; i < cursorLine(); i++) {
      startByte += (lines[i]?.length || 0) + 1; // +1 for newline
    }
    startByte += cursorColumn();

    return { start: startByte, end: startByte };
  }

  // Cleanup timers
  onCleanup(() => {
    clearTimeout(hoverDebounceTimer);
    clearTimeout(autocompleteDebounceTimer);
  });

  return (
    <div
      ref={containerRef}
      class="relative h-full w-full"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
    >
      {/* Core Editor */}
      <Editor
        bufferId={props.bufferId}
        content={props.content}
        language={props.language}
        readOnly={props.readOnly}
        onContentChange={handleContentChange}
        onCursorChange={handleCursorChange}
        onScrollChange={handleScrollChange}
        onSave={props.onSave}
      />

      {/* Hover Tooltip */}
      <HoverTooltip visible={hoverVisible()} content={hoverContent()} position={hoverPosition()} />

      {/* Autocomplete Dropdown */}
      <Show when={autocompleteVisible() && autocompleteItems().length > 0}>
        <Autocomplete
          visible={autocompleteVisible()}
          items={autocompleteItems()}
          position={autocompletePosition()}
          onSelect={handleAutocompleteSelect}
          onClose={() => setAutocompleteVisible(false)}
        />
      </Show>

      {/* Context Action Palette */}
      <ContextActionPalette
        visible={contextMenuVisible()}
        position={contextMenuPosition()}
        filePath={props.filePath || null}
        bufferId={props.bufferId}
        line={cursorLine()}
        character={cursorColumn()}
        selectionStartByte={getSelectionBytes().start}
        selectionEndByte={getSelectionBytes().end}
        selectedText={selectedText()}
        onClose={handleContextMenuClose}
        onGotoLocation={handleGotoLocation}
        onSelectionChange={handleSelectionChange}
        onShowAiPanel={handleShowAiPanel}
      />

      {/* Peek View */}
      <PeekView
        visible={peekVisible()}
        location={peekLocation()}
        position={peekPosition()}
        onClose={() => setPeekVisible(false)}
        onGotoLocation={(location) => {
          console.log("Goto location:", location);
          setPeekVisible(false);
        }}
      />
    </div>
  );
}
