/**
 * Command Registry Store
 *
 * Manages all available commands and keyboard shortcuts
 */

import { createSignal } from "solid-js";
import type { Command } from "../types";
import { editorStore } from "./editor";
import { uiStore } from "./ui";
import * as ipc from "../ipc/commands";
import {
  registerHandler,
  registerKeybinding,
  getShortcutDisplay,
  setupKeybindingListener,
} from "./keybindings";

const [isCommandPaletteOpen, setCommandPaletteOpen] = createSignal(false);

// Core commands
const coreCommands: Command[] = [
  // File commands
  {
    id: "file.save",
    title: "Save File",
    shortcut: "Cmd+S",
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
    shortcut: "Cmd+Alt+S",
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
    shortcut: "Cmd+W",
    category: "File",
    handler: () => {
      const tabId = editorStore.activeTabId();
      if (tabId) {
        editorStore.closeTab(tabId);
      }
    },
  },
  {
    id: "file.closeAll",
    title: "Close All Tabs",
    shortcut: "Cmd+Shift+W",
    category: "File",
    handler: () => {
      for (const tab of [...editorStore.tabs]) {
        editorStore.closeTab(tab.id);
      }
    },
  },

  // Edit commands
  {
    id: "edit.undo",
    title: "Undo",
    shortcut: "Cmd+Z",
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
    shortcut: "Cmd+Shift+Z",
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
  {
    id: "edit.cut",
    title: "Cut",
    shortcut: "Cmd+X",
    category: "Edit",
    handler: () => {
      document.execCommand("cut");
    },
  },
  {
    id: "edit.copy",
    title: "Copy",
    shortcut: "Cmd+C",
    category: "Edit",
    handler: () => {
      document.execCommand("copy");
    },
  },
  {
    id: "edit.paste",
    title: "Paste",
    shortcut: "Cmd+V",
    category: "Edit",
    handler: () => {
      document.execCommand("paste");
    },
  },
  {
    id: "edit.selectAll",
    title: "Select All",
    shortcut: "Cmd+A",
    category: "Edit",
    handler: () => {
      document.execCommand("selectAll");
    },
  },
  {
    id: "edit.find",
    title: "Find",
    shortcut: "Cmd+F",
    category: "Edit",
    handler: () => {
      // Will trigger find in editor
    },
  },
  {
    id: "edit.replace",
    title: "Find and Replace",
    shortcut: "Cmd+H",
    category: "Edit",
    handler: () => {
      // Will trigger find/replace
    },
  },

  // View commands
  {
    id: "view.commandPalette",
    title: "Command Palette",
    shortcut: "Cmd+Shift+P",
    category: "View",
    handler: () => {
      setCommandPaletteOpen(true);
    },
  },
  {
    id: "view.toggleSidebar",
    title: "Toggle Sidebar",
    shortcut: "Cmd+B",
    category: "View",
    handler: () => {
      uiStore.toggleSidebar();
    },
  },
  {
    id: "view.togglePanel",
    title: "Toggle Panel",
    shortcut: "Cmd+J",
    category: "View",
    handler: () => {
      uiStore.togglePanel();
    },
  },
  {
    id: "view.zoomIn",
    title: "Zoom In",
    shortcut: "Cmd+=",
    category: "View",
    handler: () => {
      // Zoom in
    },
  },
  {
    id: "view.zoomOut",
    title: "Zoom Out",
    shortcut: "Cmd+-",
    category: "View",
    handler: () => {
      // Zoom out
    },
  },
  {
    id: "view.resetZoom",
    title: "Reset Zoom",
    shortcut: "Cmd+0",
    category: "View",
    handler: () => {
      // Reset zoom
    },
  },

  // Go commands
  {
    id: "go.goToFile",
    title: "Go to File",
    shortcut: "Cmd+P",
    category: "Go",
    handler: () => {
      // Quick open file picker
      setCommandPaletteOpen(true);
    },
  },
  {
    id: "go.goToLine",
    title: "Go to Line",
    shortcut: "Cmd+G",
    category: "Go",
    handler: () => {
      // Go to line modal
    },
  },
  {
    id: "go.goToSymbol",
    title: "Go to Symbol",
    shortcut: "Cmd+Shift+O",
    category: "Go",
    handler: () => {
      // Go to symbol
    },
  },
  {
    id: "go.goToDefinition",
    title: "Go to Definition",
    shortcut: "F12",
    category: "Go",
    handler: () => {
      // LSP go to definition
    },
  },
  {
    id: "go.goToReferences",
    title: "Go to References",
    shortcut: "Shift+F12",
    category: "Go",
    handler: () => {
      // LSP find references
    },
  },

  // Terminal commands
  {
    id: "terminal.new",
    title: "New Terminal",
    shortcut: "Cmd+Shift+`",
    category: "Terminal",
    handler: () => {
      // Create new terminal
    },
  },
  {
    id: "terminal.toggle",
    title: "Toggle Terminal",
    shortcut: "Cmd+`",
    category: "Terminal",
    handler: () => {
      // Toggle terminal panel
    },
  },

  // Debug commands
  {
    id: "debug.start",
    title: "Start Debugging",
    shortcut: "F5",
    category: "Debug",
    handler: () => {
      // Start debugging
    },
  },
  {
    id: "debug.stop",
    title: "Stop Debugging",
    shortcut: "Shift+F5",
    category: "Debug",
    handler: () => {
      // Stop debugging
    },
  },
  {
    id: "debug.toggleBreakpoint",
    title: "Toggle Breakpoint",
    shortcut: "F9",
    category: "Debug",
    handler: () => {
      // Toggle breakpoint at cursor
    },
  },
];

// Initialize keybindings
function initializeKeybindings() {
  for (const cmd of coreCommands) {
    // Register command handler
    registerHandler(cmd.id, cmd.handler);

    // Register keybinding
    if (cmd.shortcut) {
      registerKeybinding(cmd.id, cmd.shortcut);
    }
  }
}

// Call initialization
initializeKeybindings();

// Setup global keyboard listener
let cleanupListener: (() => void) | null = null;

function setupKeyboardShortcuts() {
  if (cleanupListener) return cleanupListener;
  cleanupListener = setupKeybindingListener();
  return cleanupListener;
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

  // Get shortcut display for a command
  getShortcutDisplay: (commandId: string) => {
    const cmd = coreCommands.find((c) => c.id === commandId);
    if (!cmd?.shortcut) return undefined;
    return getShortcutDisplay(commandId) || cmd.shortcut;
  },

  // Register a new command
  registerCommand: (command: Command) => {
    coreCommands.push(command);
    registerHandler(command.id, command.handler);
    if (command.shortcut) {
      registerKeybinding(command.id, command.shortcut);
    }
  },
};
