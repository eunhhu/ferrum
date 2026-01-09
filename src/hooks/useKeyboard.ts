/**
 * Keyboard shortcut handling hook
 */

import { onCleanup, onMount } from "solid-js";

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: (event: KeyboardEvent) => void;
}

/**
 * Hook for handling keyboard shortcuts
 */
export function useKeyboard(bindings: KeyBinding[]) {
  const handleKeyDown = (event: KeyboardEvent) => {
    for (const binding of bindings) {
      const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();
      const ctrlMatch = !!binding.ctrl === (event.ctrlKey || event.metaKey);
      const shiftMatch = !!binding.shift === event.shiftKey;
      const altMatch = !!binding.alt === event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        binding.handler(event);
        return;
      }
    }
  };

  onMount(() => {
    window.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });
}

/**
 * Common key bindings
 */
export const CommonBindings = {
  save: (handler: () => void): KeyBinding => ({
    key: "s",
    ctrl: true,
    handler,
  }),
  saveAll: (handler: () => void): KeyBinding => ({
    key: "s",
    ctrl: true,
    shift: true,
    handler,
  }),
  open: (handler: () => void): KeyBinding => ({
    key: "o",
    ctrl: true,
    handler,
  }),
  close: (handler: () => void): KeyBinding => ({
    key: "w",
    ctrl: true,
    handler,
  }),
  find: (handler: () => void): KeyBinding => ({
    key: "f",
    ctrl: true,
    handler,
  }),
  findInFiles: (handler: () => void): KeyBinding => ({
    key: "f",
    ctrl: true,
    shift: true,
    handler,
  }),
  commandPalette: (handler: () => void): KeyBinding => ({
    key: "p",
    ctrl: true,
    shift: true,
    handler,
  }),
  quickOpen: (handler: () => void): KeyBinding => ({
    key: "p",
    ctrl: true,
    handler,
  }),
  undo: (handler: () => void): KeyBinding => ({
    key: "z",
    ctrl: true,
    handler,
  }),
  redo: (handler: () => void): KeyBinding => ({
    key: "z",
    ctrl: true,
    shift: true,
    handler,
  }),
};
