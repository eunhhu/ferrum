import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { EditorPosition, EditorTab } from "../types";

const [tabs, setTabs] = createStore<EditorTab[]>([]);
const [activeTabId, setActiveTabId] = createSignal<string | null>(null);
const [cursorPosition, setCursorPosition] = createSignal<EditorPosition>({
  line: 1,
  column: 1,
});

function generateTabId(): string {
  return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescriptreact",
    js: "javascript",
    jsx: "javascriptreact",
    json: "json",
    html: "html",
    css: "css",
    md: "markdown",
    rs: "rust",
    py: "python",
    go: "go",
  };
  return langMap[ext] || "plaintext";
}

export const editorStore = {
  tabs,
  activeTabId,
  cursorPosition,
  setCursorPosition,

  getActiveTab: () => tabs.find((t) => t.id === activeTabId()),

  openFile: (filePath: string, content: string) => {
    const existing = tabs.find((t) => t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      return existing.id;
    }

    const fileName = filePath.split("/").pop() || filePath;
    const newTab: EditorTab = {
      id: generateTabId(),
      filePath,
      fileName,
      content,
      isDirty: false,
      language: getLanguageFromPath(filePath),
    };

    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    return newTab.id;
  },

  closeTab: (tabId: string) => {
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const newTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(newTabs);

    if (activeTabId() === tabId) {
      const newActiveIndex = Math.min(index, newTabs.length - 1);
      setActiveTabId(newTabs[newActiveIndex]?.id || null);
    }
  },

  setActiveTab: (tabId: string) => {
    if (tabs.some((t) => t.id === tabId)) {
      setActiveTabId(tabId);
    }
  },

  updateContent: (tabId: string, content: string) => {
    setTabs((t) => t.id === tabId, "content", content);
    setTabs((t) => t.id === tabId, "isDirty", true);
  },

  markSaved: (tabId: string) => {
    setTabs((t) => t.id === tabId, "isDirty", false);
  },
};
