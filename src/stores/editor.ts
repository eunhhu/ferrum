import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import * as ipc from "../ipc/commands";
import { isTauriEnvironment } from "../ipc/tauri-check";
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
    toml: "toml",
    yaml: "yaml",
    yml: "yaml",
  };
  return langMap[ext] || "plaintext";
}

export const editorStore = {
  tabs,
  activeTabId,
  cursorPosition,
  setCursorPosition,

  getActiveTab: () => tabs.find((t) => t.id === activeTabId()),

  getActiveBufferId: () => {
    const tab = tabs.find((t) => t.id === activeTabId());
    return tab?.bufferId || null;
  },

  // Open file with backend buffer integration
  async openFileWithBuffer(filePath: string): Promise<string | null> {
    // Check if already open
    const existing = tabs.find((t) => t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      return existing.id;
    }

    const fileName = filePath.split("/").pop() || filePath;
    const tabId = generateTabId();

    if (isTauriEnvironment()) {
      try {
        // Open file and create backend buffer
        const bufferInfo = await ipc.openFileBuffer(filePath);

        const newTab: EditorTab = {
          id: tabId,
          filePath,
          fileName,
          content: bufferInfo.content,
          isDirty: bufferInfo.is_dirty,
          language: bufferInfo.language || getLanguageFromPath(filePath),
          bufferId: bufferInfo.id,
        };

        setTabs([...tabs, newTab]);
        setActiveTabId(tabId);
        return tabId;
      } catch (e) {
        console.error("Failed to open file buffer:", e);
        return null;
      }
    } else {
      // Demo mode - no backend
      const newTab: EditorTab = {
        id: tabId,
        filePath,
        fileName,
        content: `// Demo content for ${fileName}`,
        isDirty: false,
        language: getLanguageFromPath(filePath),
      };

      setTabs([...tabs, newTab]);
      setActiveTabId(tabId);
      return tabId;
    }
  },

  // Legacy openFile for demo mode compatibility
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

  // Sync content change to backend buffer
  async syncToBuffer(tabId: string, content: string): Promise<boolean> {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab?.bufferId || !isTauriEnvironment()) {
      return false;
    }

    try {
      // Get current buffer content to calculate diff
      const currentBuffer = await ipc.bufferContent(tab.bufferId);
      const oldContent = currentBuffer.content;

      if (oldContent === content) {
        return true; // No change needed
      }

      // For simplicity, replace entire content
      // In production, you'd want incremental updates
      await ipc.bufferReplace(tab.bufferId, 0, oldContent.length, content);
      return true;
    } catch (e) {
      console.error("Failed to sync buffer:", e);
      return false;
    }
  },

  // Save file to disk
  async saveFile(tabId: string): Promise<boolean> {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return false;

    if (isTauriEnvironment()) {
      try {
        if (tab.bufferId) {
          // Sync content first, then save via buffer
          await this.syncToBuffer(tabId, tab.content);
          await ipc.bufferSave(tab.bufferId);
        } else {
          // Direct file write if no buffer
          await ipc.writeFile(tab.filePath, tab.content);
        }
        setTabs((t) => t.id === tabId, "isDirty", false);
        return true;
      } catch (e) {
        console.error("Failed to save file:", e);
        return false;
      }
    } else {
      // Demo mode - just mark as saved
      setTabs((t) => t.id === tabId, "isDirty", false);
      return true;
    }
  },

  // Undo operation
  async undo(tabId: string): Promise<boolean> {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab?.bufferId || !isTauriEnvironment()) return false;

    try {
      const result = await ipc.bufferUndo(tab.bufferId);
      setTabs((t) => t.id === tabId, "content", result.content);
      setTabs((t) => t.id === tabId, "isDirty", result.is_dirty);
      return true;
    } catch (e) {
      console.error("Failed to undo:", e);
      return false;
    }
  },

  // Redo operation
  async redo(tabId: string): Promise<boolean> {
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab?.bufferId || !isTauriEnvironment()) return false;

    try {
      const result = await ipc.bufferRedo(tab.bufferId);
      setTabs((t) => t.id === tabId, "content", result.content);
      setTabs((t) => t.id === tabId, "isDirty", result.is_dirty);
      return true;
    } catch (e) {
      console.error("Failed to redo:", e);
      return false;
    }
  },

  markSaved: (tabId: string) => {
    setTabs((t) => t.id === tabId, "isDirty", false);
  },
};
