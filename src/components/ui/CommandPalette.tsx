/**
 * Command Palette Component
 *
 * A VSCode-style command palette for quick actions.
 * Activated with Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
  onMount,
} from "solid-js";
import type { Command } from "../../types";

interface CommandPaletteProps {
  commands: Command[];
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette(props: CommandPaletteProps) {
  let inputRef: HTMLInputElement | undefined;

  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  // Filter commands based on query
  const filteredCommands = createMemo(() => {
    const q = query().toLowerCase();
    if (!q) return props.commands;

    return props.commands.filter((cmd) => {
      const titleMatch = cmd.title.toLowerCase().includes(q);
      const categoryMatch = cmd.category?.toLowerCase().includes(q);
      return titleMatch || categoryMatch;
    });
  });

  // Reset state when opened
  const handleOpen = () => {
    setQuery("");
    setSelectedIndex(0);
    setTimeout(() => inputRef?.focus(), 0);
  };

  // Handle keyboard navigation
  function handleKeyDown(e: KeyboardEvent) {
    const commands = filteredCommands();

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, commands.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        const selected = commands[selectedIndex()];
        if (selected) {
          selected.handler();
          props.onClose();
        }
        break;
      case "Escape":
        e.preventDefault();
        props.onClose();
        break;
    }
  }

  // Reset selection when query changes
  const handleInput = (e: InputEvent) => {
    const target = e.target as HTMLInputElement;
    setQuery(target.value);
    setSelectedIndex(0);
  };

  // Focus input when opened
  onMount(() => {
    if (props.isOpen) {
      handleOpen();
    }
  });

  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <div
        class="fixed inset-0 bg-black/50 z-50"
        onClick={() => props.onClose()}
      />

      {/* Palette */}
      <div class="fixed top-20 left-1/2 -translate-x-1/2 w-[600px] max-w-[90vw] z-50">
        <div class="bg-bg-secondary border border-border rounded-lg shadow-2xl overflow-hidden">
          {/* Search input */}
          <div class="flex items-center border-b border-border">
            <span class="px-3 text-text-tertiary">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 2a8 8 0 105.293 14.707l4 4 1.414-1.414-4-4A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z" />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="text"
              class="flex-1 py-3 pr-3 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
              placeholder="Type a command..."
              value={query()}
              onInput={handleInput}
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Command list */}
          <div class="max-h-80 overflow-y-auto">
            <Show
              when={filteredCommands().length > 0}
              fallback={
                <div class="px-4 py-8 text-center text-text-tertiary">
                  No commands found
                </div>
              }
            >
              <For each={filteredCommands()}>
                {(command, index) => (
                  <div
                    class="flex items-center justify-between px-4 py-2 cursor-pointer"
                    classList={{
                      "bg-accent/20": index() === selectedIndex(),
                      "hover:bg-bg-hover": index() !== selectedIndex(),
                    }}
                    onClick={() => {
                      command.handler();
                      props.onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index())}
                  >
                    <div class="flex items-center gap-3">
                      <Show when={command.category}>
                        <span class="text-xs text-text-tertiary">
                          {command.category}
                        </span>
                      </Show>
                      <span class="text-text-primary">{command.title}</span>
                    </div>
                    <Show when={command.shortcut}>
                      <kbd class="px-2 py-0.5 bg-bg-tertiary text-text-secondary text-xs rounded">
                        {command.shortcut}
                      </kbd>
                    </Show>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
}
