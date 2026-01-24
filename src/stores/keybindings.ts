/**
 * Keybindings Store
 *
 * Robust keyboard shortcut system with cross-platform support
 */

import { createSignal } from "solid-js";

/** Modifier keys */
export interface Modifiers {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/** A parsed keybinding */
export interface Keybinding {
  key: string;
  modifiers: Modifiers;
}

/** A registered keybinding with command */
export interface RegisteredKeybinding {
  id: string;
  keybinding: Keybinding;
  commandId: string;
  when?: string | undefined;
}

const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");

/**
 * Parse a shortcut string into a Keybinding
 * Examples: "Cmd+S", "Ctrl+Shift+P", "Alt+Enter"
 */
export function parseShortcut(shortcut: string): Keybinding | null {
  const parts = shortcut.split("+").map((p) => p.trim().toLowerCase());

  const modifiers: Modifiers = {
    ctrl: false,
    alt: false,
    shift: false,
    meta: false,
  };

  let key = "";

  for (const part of parts) {
    switch (part) {
      case "cmd":
      case "command":
      case "meta":
      case "⌘":
        modifiers.meta = true;
        break;
      case "ctrl":
      case "control":
      case "^":
        modifiers.ctrl = true;
        break;
      case "alt":
      case "option":
      case "opt":
      case "⌥":
        modifiers.alt = true;
        break;
      case "shift":
      case "⇧":
        modifiers.shift = true;
        break;
      default:
        // This is the actual key
        key = part;
    }
  }

  if (!key) return null;

  // Normalize key names
  key = normalizeKey(key);

  return { key, modifiers };
}

/**
 * Normalize key names to match event.key
 */
function normalizeKey(key: string): string {
  const keyMap: Record<string, string> = {
    esc: "escape",
    del: "delete",
    ins: "insert",
    pgup: "pageup",
    pgdn: "pagedown",
    return: "enter",
    space: " ",
    up: "arrowup",
    down: "arrowdown",
    left: "arrowleft",
    right: "arrowright",
  };

  return keyMap[key] || key;
}

/**
 * Convert a Keybinding back to display string
 */
export function formatKeybinding(kb: Keybinding): string {
  const parts: string[] = [];

  if (isMac) {
    if (kb.modifiers.ctrl) parts.push("⌃");
    if (kb.modifiers.alt) parts.push("⌥");
    if (kb.modifiers.shift) parts.push("⇧");
    if (kb.modifiers.meta) parts.push("⌘");
  } else {
    if (kb.modifiers.ctrl) parts.push("Ctrl");
    if (kb.modifiers.alt) parts.push("Alt");
    if (kb.modifiers.shift) parts.push("Shift");
    if (kb.modifiers.meta) parts.push("Win");
  }

  // Format key for display
  let displayKey = kb.key.toUpperCase();
  if (kb.key === " ") displayKey = "Space";
  if (kb.key === "escape") displayKey = "Esc";
  if (kb.key === "arrowup") displayKey = "↑";
  if (kb.key === "arrowdown") displayKey = "↓";
  if (kb.key === "arrowleft") displayKey = "←";
  if (kb.key === "arrowright") displayKey = "→";
  if (kb.key === "enter") displayKey = "↵";
  if (kb.key === "backspace") displayKey = "⌫";
  if (kb.key === "delete") displayKey = "⌦";
  if (kb.key === "tab") displayKey = "⇥";

  parts.push(displayKey);

  return isMac ? parts.join("") : parts.join("+");
}

/**
 * Check if a KeyboardEvent matches a Keybinding
 */
export function matchesKeybinding(event: KeyboardEvent, kb: Keybinding): boolean {
  // Check modifiers - handling the Cmd/Ctrl platform difference
  if (isMac) {
    if (event.metaKey !== kb.modifiers.meta) return false;
    if (event.ctrlKey !== kb.modifiers.ctrl) return false;
  } else {
    // On Windows/Linux, treat Meta (Cmd) bindings as Ctrl
    if (kb.modifiers.meta) {
      if (!event.ctrlKey) return false;
    } else if (event.ctrlKey !== kb.modifiers.ctrl) return false;
    if (event.metaKey) return false; // Windows key shouldn't be pressed
  }

  if (event.altKey !== kb.modifiers.alt) return false;
  if (event.shiftKey !== kb.modifiers.shift) return false;

  // Check key
  return event.key.toLowerCase() === kb.key;
}

// Registered keybindings
const [keybindings, setKeybindings] = createSignal<RegisteredKeybinding[]>([]);

// Command handlers
const handlers = new Map<string, () => void | Promise<void>>();

/**
 * Register a command handler
 */
export function registerHandler(commandId: string, handler: () => void | Promise<void>) {
  handlers.set(commandId, handler);
}

/**
 * Register a keybinding
 */
export function registerKeybinding(commandId: string, shortcut: string, when?: string): void {
  const keybinding = parseShortcut(shortcut);
  if (!keybinding) {
    console.warn(`Invalid keybinding: ${shortcut}`);
    return;
  }

  const id = `kb-${commandId}-${Date.now()}`;

  setKeybindings((prev) => [...prev, { id, keybinding, commandId, when }]);
}

/**
 * Remove a keybinding
 */
export function removeKeybinding(commandId: string): void {
  setKeybindings((prev) => prev.filter((kb) => kb.commandId !== commandId));
}

/**
 * Get keybinding for a command
 */
export function getKeybindingForCommand(commandId: string): Keybinding | undefined {
  const binding = keybindings().find((kb) => kb.commandId === commandId);
  return binding?.keybinding;
}

/**
 * Get formatted shortcut string for a command
 */
export function getShortcutDisplay(commandId: string): string | undefined {
  const kb = getKeybindingForCommand(commandId);
  return kb ? formatKeybinding(kb) : undefined;
}

// Context for "when" conditions
const [contextKeys, setContextKeys] = createSignal<Record<string, boolean>>({});

/**
 * Set a context key for conditional keybindings
 */
export function setContextKey(key: string, value: boolean): void {
  setContextKeys((prev) => ({ ...prev, [key]: value }));
}

/**
 * Check if a "when" condition is satisfied
 */
function evaluateWhen(when: string | undefined): boolean {
  if (!when) return true;

  const ctx = contextKeys();

  // Simple condition evaluation: "editorFocus && !inputFocus"
  const parts = when.split(/\s*&&\s*/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith("!")) {
      const key = trimmed.slice(1);
      if (ctx[key]) return false;
    } else if (!ctx[trimmed]) return false;
  }

  return true;
}

/**
 * Handle a keyboard event
 * Returns true if a keybinding was triggered
 */
export function handleKeyboardEvent(event: KeyboardEvent): boolean {
  for (const binding of keybindings()) {
    if (matchesKeybinding(event, binding.keybinding)) {
      if (!evaluateWhen(binding.when)) continue;

      const handler = handlers.get(binding.commandId);
      if (handler) {
        event.preventDefault();
        event.stopPropagation();
        handler();
        return true;
      }
    }
  }

  return false;
}

/**
 * Setup global keyboard event listener
 */
export function setupKeybindingListener(): () => void {
  const listener = (event: KeyboardEvent) => {
    // Ignore if inside input/textarea (unless it's a global command)
    const target = event.target as HTMLElement;
    const isInput =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

    // Set context
    setContextKey("inputFocus", isInput);

    // Always handle certain shortcuts
    handleKeyboardEvent(event);
  };

  document.addEventListener("keydown", listener, true);
  return () => document.removeEventListener("keydown", listener, true);
}

export const keybindingsStore = {
  keybindings,
  registerHandler,
  registerKeybinding,
  removeKeybinding,
  getKeybindingForCommand,
  getShortcutDisplay,
  setContextKey,
  handleKeyboardEvent,
  setupKeybindingListener,
  parseShortcut,
  formatKeybinding,
};
