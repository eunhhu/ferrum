/**
 * Editor Component Types
 *
 * Centralized type definitions for the editor system.
 */

import type { HighlightSpan } from "../../ipc/types";

// Editor configuration constants
export const EDITOR_CONFIG = {
  LINE_HEIGHT: 20,
  VISIBLE_LINE_BUFFER: 5,
  GUTTER_WIDTH: 50,
  CONTENT_PADDING: 10,
  HIGHLIGHT_DEBOUNCE_MS: 100,
  FONT_FAMILY: "'Fira Code', 'JetBrains Mono', Menlo, Monaco, 'Courier New', monospace",
  FONT_SIZE: 13,
} as const;

export const LEFT_OFFSET = EDITOR_CONFIG.GUTTER_WIDTH + EDITOR_CONFIG.CONTENT_PADDING;

// Cursor position in the editor
export interface Cursor {
  line: number;
  column: number;
  offset: number;
}

// Editor internal state
export interface EditorState {
  lines: string[];
  cursor: Cursor;
  selectionAnchor: Cursor | null;
  isDragging: boolean;
  scrollTop: number;
  scrollLeft: number;
  highlights: HighlightSpan[];
  compositionText: string | null;
}

// Props for the Editor component
export interface EditorProps {
  bufferId: string;
  content: string;
  language?: string | undefined;
  readOnly?: boolean | undefined;
  onContentChange?: (content: string) => void;
  onCursorChange?: (line: number, column: number) => void;
  onScrollChange?: (scrollTop: number, visibleStartLine: number) => void;
  onSave?: (() => void) | undefined;
}

// Selection rectangle for rendering
export interface SelectionRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

// Visible line data
export interface VisibleLine {
  number: number;
  content: string;
}

// Range of visible lines
export interface VisibleRange {
  start: number;
  end: number;
}
