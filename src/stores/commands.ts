/**
 * Command Registry Store
 *
 * Manages all available commands and keyboard shortcuts
 */

import { createSignal } from "solid-js";
import type { Command } from "../types";
import { editorStore } from "./editor";
import * as ipc from "../ipc/commands";

const [isCommandPaletteOpen, setCommandPaletteOpen] = createSignal(false);

// Core commands
const coreCommands: Command[] = [
  // File commands
  {
    id: "file.save",
    title: "Save File",
    shortcut: "⌘S",
    category: "File",
    handler: async () => {
      const tab = editorStore.getActiveTab();
      if (tab?.bufferId) {
        try {
          await ipc.bufferSave(tab.bufferId);
          editorStore.markSaved(tab.id);
        } catch (e) {
          console.error("Failed to save:", e);
        }
      }
    },
  },
  {
    id: "file.saveAll",
    title: "Save All",
    shortcut: "⌘⌥S",
    category: "File",
    handler: async () => {
      for (const tab of editorStore.tabs) {
        if (tab.isDirty && tab.bufferId) {
          try {
            await ipc.bufferSave(tab.bufferId);
            editorStore.markSaved(tab.id);
          } catch (e) {
            console.error("Failed to save:", e);
          }
        }
      }
    },
  },
  {
    id: "file.close",
    title: "Close Tab",
    shortcut: "⌘W",
    category: "File",
    handler: () => {
      const tabId = editorStore.activeTabId();
      if (tabId) {
        editorStore.closeTab(tabId);
      }
    },
  },

  // Edit commands
  {
    id: "edit.undo",
    title: "Undo",
    shortcut: "⌘Z",
    category: "Edit",
    handler: async () => {
      const tab = editorStore.getActiveTab();
      if (tab?.bufferId) {
        try {
          const result = await ipc.bufferUndo(tab.bufferId);
          editorStore.updateContent(tab.id, result.content);
        } catch (e) {
          console.error("Undo failed:", e);
        }
      }
    },
  },
  {
    id: "edit.redo",
    title: "Redo",
    shortcut: "⌘⇧Z",
    category: "Edit",
    handler: async () => {
      const tab = editorStore.getActiveTab();
      if (tab?.bufferId) {
        try {
          const result = await ipc.bufferRedo(tab.bufferId);
          editorStore.updateContent(tab.id, result.content);
        } catch (e) {
          console.error("Redo failed:", e);
        }
      }
    },
  },

  // View commands
  {
    id: "view.commandPalette",
    title: "Command Palette",
    shortcut: "⌘⇧P",
    category: "View",
    handler: () => {
      setCommandPaletteOpen(true);
    },
  },
  {
    id: "view.toggleSidebar",
    title: "Toggle Sidebar",
    shortcut: "⌘B",
    category: "View",
    handler: () => {
      // Will be implemented when uiStore is connected
    },
  },
  {
    id: "view.togglePanel",
    title: "Toggle Panel",
    shortcut: "⌘J",
    category: "View",
    handler: () => {
      // Will be implemented when uiStore is connected
    },
  },

  // Go commands
  {
    id: "go.goToFile",
    title: "Go to File",
    shortcut: "⌘P",
    category: "Go",
    handler: () => {
      // Quick open file picker
      setCommandPaletteOpen(true);
    },
  },
  {
    id: "go.goToLine",
    title: "Go to Line",
    shortcut: "⌘G",
    category: "Go",
    handler: () => {
      // Go to line modal
    },
  },
];

// Handle global keyboard shortcuts
function setupKeyboardShortcuts() {
  const handleKeyDown = (e: KeyboardEvent) => {
    const isMeta = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;

    // Command Palette: Cmd+Shift+P
    if (isMeta && isShift && e.key === "p") {
      e.preventDefault();
      setCommandPaletteOpen(true);
      return;
    }

    // Save: Cmd+S
    if (isMeta && !isShift && e.key === "s") {
      e.preventDefault();
      const saveCmd = coreCommands.find((c) => c.id === "file.save");
      saveCmd?.handler();
      return;
    }

    // Close: Cmd+W
    if (isMeta && e.key === "w") {
      e.preventDefault();
      const closeCmd = coreCommands.find((c) => c.id === "file.close");
      closeCmd?.handler();
      return;
    }
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}

export const commandsStore = {
  commands: coreCommands,
  isCommandPaletteOpen,
  setCommandPaletteOpen,
  openCommandPalette: () => setCommandPaletteOpen(true),
  closeCommandPalette: () => setCommandPaletteOpen(false),
  setupKeyboardShortcuts,

  // Execute a command by ID
  execute: (commandId: string) => {
    const cmd = coreCommands.find((c) => c.id === commandId);
    if (cmd) {
      cmd.handler();
    }
  },

  // Get all commands
  getCommands: () => coreCommands,
};
