/**
 * Terminal Panel Component
 *
 * Manages multiple terminal tabs.
 */

import {
  createSignal,
  createMemo,
  For,
  Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import { Terminal } from "./Terminal";

interface TerminalTab {
  id: string;
  title: string;
  cwd?: string;
}

export function TerminalPanel() {
  const [tabs, setTabs] = createStore<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = createSignal<string | null>(null);

  const activeTab = createMemo(() =>
    tabs.find((t) => t.id === activeTabId())
  );

  // Create a new terminal
  function createTerminal(cwd?: string) {
    const id = `term-${Date.now()}`;
    const tab: TerminalTab = {
      id,
      title: "Terminal",
      ...(cwd !== undefined ? { cwd } : {}),
    };

    setTabs([...tabs, tab]);
    setActiveTabId(id);
  }

  // Close a terminal
  function closeTerminal(id: string) {
    const index = tabs.findIndex((t) => t.id === id);
    if (index === -1) return;

    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);

    // Select another tab
    if (activeTabId() === id) {
      const newIndex = Math.min(index, newTabs.length - 1);
      setActiveTabId(newTabs[newIndex]?.id ?? null);
    }
  }

  // Update terminal title
  function updateTitle(id: string, title: string) {
    setTabs(
      (t) => t.id === id,
      "title",
      title || "Terminal"
    );
  }

  // Create first terminal if none
  if (tabs.length === 0) {
    createTerminal();
  }

  return (
    <div class="h-full flex flex-col bg-bg-primary">
      {/* Tab bar */}
      <div class="flex items-center h-9 bg-bg-secondary border-b border-border">
        {/* Tabs */}
        <div class="flex-1 flex items-center overflow-x-auto">
          <For each={tabs}>
            {(tab) => (
              <div
                class="flex items-center gap-2 px-3 h-9 cursor-pointer border-r border-border"
                classList={{
                  "bg-bg-primary text-text-primary": activeTabId() === tab.id,
                  "bg-bg-tertiary text-text-secondary hover:bg-bg-hover": activeTabId() !== tab.id,
                }}
                onClick={() => setActiveTabId(tab.id)}
              >
                {/* Terminal icon */}
                <span class="text-sm">⬛</span>

                {/* Title */}
                <span class="text-sm truncate max-w-32">{tab.title}</span>

                {/* Close button */}
                <button
                  class="w-4 h-4 flex items-center justify-center rounded hover:bg-bg-active text-text-tertiary hover:text-text-primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(tab.id);
                  }}
                >
                  ×
                </button>
              </div>
            )}
          </For>
        </div>

        {/* Actions */}
        <div class="flex items-center px-2 gap-1">
          {/* New terminal button */}
          <button
            class="w-7 h-7 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary"
            onClick={() => createTerminal()}
            title="New Terminal"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>

          {/* Split button */}
          <button
            class="w-7 h-7 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary"
            title="Split Terminal"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11 3H3v18h8v-2H5V5h6V3zm10 0h-8v2h6v14h-6v2h8V3z" />
            </svg>
          </button>

          {/* Kill button */}
          <button
            class="w-7 h-7 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary"
            onClick={() => {
              const id = activeTabId();
              if (id) closeTerminal(id);
            }}
            title="Kill Terminal"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Terminal content */}
      <div class="flex-1 overflow-hidden">
        <Show
          when={activeTab()}
          fallback={
            <div class="h-full flex items-center justify-center text-text-tertiary">
              <button
                class="px-4 py-2 bg-accent text-white rounded hover:bg-accent/80"
                onClick={() => createTerminal()}
              >
                Create Terminal
              </button>
            </div>
          }
        >
          {(tab) => (
            <Terminal
              id={tab().id}
              cwd={tab().cwd}
              onTitleChange={(title) => updateTitle(tab().id, title)}
              onExit={() => {
                // Optionally close on exit
              }}
            />
          )}
        </Show>
      </div>
    </div>
  );
}
