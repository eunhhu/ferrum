/**
 * Core TypeScript types for Ferrum IDE
 */

// Re-export IPC types
export * from "../ipc/types";

// Legacy types (keeping for compatibility with existing components)
export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  isExpanded?: boolean;
  isHidden?: boolean;
  gitStatus?: GitFileStatus;
}

export interface EditorTab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isDirty: boolean;
  language: string;
  bufferId?: string;
  isPreview?: boolean;
  isPinned?: boolean;
}

export interface PanelTab {
  id: string;
  label: string;
  type: "terminal" | "output" | "problems" | "debug";
}

export type SidebarView = "explorer" | "search" | "git" | "extensions" | "debug";

// Position types
export interface Point {
  line: number;
  column: number;
}

export interface Range {
  start: Point;
  end: Point;
}

// Keep legacy aliases
export type EditorPosition = Point;
export interface EditorSelection {
  start: EditorPosition;
  end: EditorPosition;
}

// Selection
export interface Selection {
  anchor: Point;
  head: Point;
}

// Panel
export type PanelPosition = "left" | "right" | "bottom";

export interface PanelState {
  position: PanelPosition;
  visible: boolean;
  size: number;
}

// Activity
export type ActivityType =
  | "explorer"
  | "search"
  | "git"
  | "debug"
  | "extensions"
  | "settings";

// Theme
export interface ThemeColors {
  background: string;
  surface: string;
  surfaceHover: string;
  foreground: string;
  foregroundMuted: string;
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  border: string;
  selection: string;
  cursor: string;
}

export interface SyntaxColors {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  function: string;
  type: string;
  variable: string;
  operator: string;
}

export interface Theme {
  name: string;
  isDark: boolean;
  colors: ThemeColors;
  syntax: SyntaxColors;
}

// Command
export interface Command {
  id: string;
  title: string;
  shortcut?: string;
  category?: string;
  handler: () => void;
}

export type GitFileStatus =
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "ignored"
  | "conflicted";

// Diagnostic
export interface Diagnostic {
  range: Range;
  severity: DiagnosticSeverity;
  message: string;
  source?: string;
  code?: string;
}

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

// Completion
export interface CompletionItem {
  label: string;
  kind: CompletionKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
}

export type CompletionKind =
  | "text"
  | "method"
  | "function"
  | "constructor"
  | "field"
  | "variable"
  | "class"
  | "interface"
  | "module"
  | "property"
  | "unit"
  | "value"
  | "enum"
  | "keyword"
  | "snippet"
  | "color"
  | "file"
  | "reference"
  | "folder"
  | "constant"
  | "struct"
  | "event"
  | "operator"
  | "typeParameter";
