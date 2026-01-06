export interface FileNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  isExpanded?: boolean;
}

export interface EditorTab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  isDirty: boolean;
  language: string;
}

export interface PanelTab {
  id: string;
  label: string;
  type: "terminal" | "output" | "problems";
}

export type SidebarView = "explorer" | "search" | "git" | "extensions";

export interface EditorPosition {
  line: number;
  column: number;
}

export interface EditorSelection {
  start: EditorPosition;
  end: EditorPosition;
}
