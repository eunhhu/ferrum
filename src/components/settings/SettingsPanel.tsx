/**
 * Settings Panel Component
 *
 * VSCode-style settings UI with categories and search.
 */

import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import * as ipc from "../../ipc/commands";
import type { EditorSettings, Settings, TerminalSettings, UISettings } from "../../ipc/types";

interface SettingItem {
  key: string;
  label: string;
  description: string;
  category: string;
  type: "string" | "number" | "boolean" | "select";
  options?: string[];
  min?: number;
  max?: number;
}

const SETTINGS_SCHEMA: SettingItem[] = [
  // Editor settings
  {
    key: "editor.font_family",
    label: "Font Family",
    description: "Controls the font family used in the editor",
    category: "Editor",
    type: "string",
  },
  {
    key: "editor.font_size",
    label: "Font Size",
    description: "Controls the font size in pixels",
    category: "Editor",
    type: "number",
    min: 8,
    max: 72,
  },
  {
    key: "editor.line_height",
    label: "Line Height",
    description: "Controls the line height as a multiplier",
    category: "Editor",
    type: "number",
    min: 1,
    max: 3,
  },
  {
    key: "editor.tab_size",
    label: "Tab Size",
    description: "The number of spaces a tab is equal to",
    category: "Editor",
    type: "number",
    min: 1,
    max: 8,
  },
  {
    key: "editor.insert_spaces",
    label: "Insert Spaces",
    description: "Insert spaces when pressing Tab",
    category: "Editor",
    type: "boolean",
  },
  {
    key: "editor.word_wrap",
    label: "Word Wrap",
    description: "Enable word wrapping",
    category: "Editor",
    type: "boolean",
  },
  {
    key: "editor.minimap_enabled",
    label: "Show Minimap",
    description: "Controls whether the minimap is displayed",
    category: "Editor",
    type: "boolean",
  },
  {
    key: "editor.line_numbers",
    label: "Line Numbers",
    description: "Controls the display of line numbers",
    category: "Editor",
    type: "boolean",
  },
  {
    key: "editor.highlight_active_line",
    label: "Highlight Active Line",
    description: "Highlights the line containing the cursor",
    category: "Editor",
    type: "boolean",
  },
  {
    key: "editor.bracket_pair_colorization",
    label: "Bracket Pair Colorization",
    description: "Enables bracket pair colorization",
    category: "Editor",
    type: "boolean",
  },
  {
    key: "editor.auto_save",
    label: "Auto Save",
    description: "Automatically save files after a delay",
    category: "Editor",
    type: "boolean",
  },
  {
    key: "editor.auto_save_delay_ms",
    label: "Auto Save Delay",
    description: "Delay in milliseconds before auto save",
    category: "Editor",
    type: "number",
    min: 100,
    max: 10000,
  },
  {
    key: "editor.format_on_save",
    label: "Format On Save",
    description: "Format the file when saving",
    category: "Editor",
    type: "boolean",
  },

  // Terminal settings
  {
    key: "terminal.shell",
    label: "Shell Path",
    description: "Path to the shell executable (empty for default)",
    category: "Terminal",
    type: "string",
  },
  {
    key: "terminal.font_family",
    label: "Terminal Font Family",
    description: "Font family for the terminal",
    category: "Terminal",
    type: "string",
  },
  {
    key: "terminal.font_size",
    label: "Terminal Font Size",
    description: "Font size for the terminal in pixels",
    category: "Terminal",
    type: "number",
    min: 8,
    max: 32,
  },
  {
    key: "terminal.cursor_style",
    label: "Cursor Style",
    description: "The style of the terminal cursor",
    category: "Terminal",
    type: "select",
    options: ["block", "underline", "bar"],
  },
  {
    key: "terminal.cursor_blink",
    label: "Cursor Blink",
    description: "Enable cursor blinking in the terminal",
    category: "Terminal",
    type: "boolean",
  },

  // UI settings
  {
    key: "ui.theme",
    label: "Color Theme",
    description: "The color theme for the workbench",
    category: "Appearance",
    type: "select",
    options: ["Ferrum Dark", "Ferrum Light"],
  },
  {
    key: "ui.sidebar_position",
    label: "Sidebar Position",
    description: "Position of the sidebar",
    category: "Appearance",
    type: "select",
    options: ["left", "right"],
  },
  {
    key: "ui.activity_bar_visible",
    label: "Activity Bar Visible",
    description: "Show the activity bar",
    category: "Appearance",
    type: "boolean",
  },
  {
    key: "ui.status_bar_visible",
    label: "Status Bar Visible",
    description: "Show the status bar",
    category: "Appearance",
    type: "boolean",
  },
  {
    key: "ui.tab_close_button",
    label: "Tab Close Button",
    description: "Show close button on tabs",
    category: "Appearance",
    type: "boolean",
  },
  {
    key: "ui.breadcrumbs_enabled",
    label: "Breadcrumbs",
    description: "Enable breadcrumb navigation",
    category: "Appearance",
    type: "boolean",
  },
];

const CATEGORIES = ["Editor", "Terminal", "Appearance"];

export function SettingsPanel() {
  const [settings, setSettings] = createStore<Settings>({
    editor: {} as EditorSettings,
    terminal: {} as TerminalSettings,
    ui: {} as UISettings,
  });
  const [isLoading, setIsLoading] = createSignal(true);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [selectedCategory, setSelectedCategory] = createSignal<string | null>(null);
  const [modifiedKeys, setModifiedKeys] = createSignal<Set<string>>(new Set());

  // Load settings on mount
  createEffect(async () => {
    try {
      const loaded = await ipc.getSettings();
      setSettings(loaded);
    } catch (e) {
      console.error("Failed to load settings:", e);
    } finally {
      setIsLoading(false);
    }
  });

  // Filter settings based on search and category
  const filteredSettings = createMemo(() => {
    const query = searchQuery().toLowerCase();
    const category = selectedCategory();

    return SETTINGS_SCHEMA.filter((item) => {
      // Category filter
      if (category && item.category !== category) {
        return false;
      }

      // Search filter
      if (query) {
        return (
          item.label.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query) ||
          item.key.toLowerCase().includes(query)
        );
      }

      return true;
    });
  });

  // Group settings by category
  const groupedSettings = createMemo(() => {
    const groups: Record<string, SettingItem[]> = {};
    for (const item of filteredSettings()) {
      if (!groups[item.category]) {
        groups[item.category] = [];
      }
      groups[item.category]!.push(item);
    }
    return groups;
  });

  // Get value from settings
  function getValue(key: string): unknown {
    const parts = key.split(".");
    if (parts.length !== 2) return undefined;

    const [section, prop] = parts as [keyof Settings, string];
    const sectionObj = settings[section];
    if (!sectionObj) return undefined;

    return (sectionObj as unknown as Record<string, unknown>)[prop];
  }

  // Update a setting value
  async function updateValue(key: string, value: unknown) {
    const parts = key.split(".");
    if (parts.length !== 2) return;

    const [section, prop] = parts as [keyof Settings, string];

    // Update local state
    setSettings(section, prop as keyof (typeof settings)[typeof section], value as never);

    // Mark as modified
    setModifiedKeys((prev) => new Set([...prev, key]));

    // Save to backend
    try {
      const updates = { [section]: { [prop]: value } };
      await ipc.updateSettings(updates);
    } catch (e) {
      console.error("Failed to update setting:", e);
    }
  }

  function renderSettingControl(item: SettingItem) {
    const value = getValue(item.key);

    switch (item.type) {
      case "boolean":
        return (
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              class="w-4 h-4 rounded border-border bg-bg-secondary"
              checked={value as boolean}
              onChange={(e) => updateValue(item.key, e.currentTarget.checked)}
            />
            <span class="text-sm text-text-primary">{value ? "On" : "Off"}</span>
          </label>
        );

      case "number":
        return (
          <input
            type="number"
            class="w-24 px-2 py-1 bg-bg-secondary border border-border rounded text-text-primary text-sm focus:outline-none focus:border-accent"
            value={value as number}
            min={item.min}
            max={item.max}
            onInput={(e) => {
              const num = Number.parseFloat(e.currentTarget.value);
              if (!isNaN(num)) {
                updateValue(item.key, num);
              }
            }}
          />
        );

      case "select":
        return (
          <select
            class="px-2 py-1 bg-bg-secondary border border-border rounded text-text-primary text-sm focus:outline-none focus:border-accent"
            value={(value as string) || ""}
            onChange={(e) => updateValue(item.key, e.currentTarget.value)}
          >
            <For each={item.options}>{(option) => <option value={option}>{option}</option>}</For>
          </select>
        );

      case "string":
      default:
        return (
          <input
            type="text"
            class="w-64 px-2 py-1 bg-bg-secondary border border-border rounded text-text-primary text-sm focus:outline-none focus:border-accent"
            value={(value as string) || ""}
            onInput={(e) => updateValue(item.key, e.currentTarget.value)}
          />
        );
    }
  }

  return (
    <div class="h-full flex bg-bg-primary">
      {/* Sidebar */}
      <div class="w-48 border-r border-border bg-bg-secondary flex flex-col">
        <div class="p-3 border-b border-border">
          <span class="text-sm font-medium text-text-primary">Settings</span>
        </div>

        {/* Categories */}
        <div class="flex-1 overflow-auto py-2">
          <button
            class="w-full px-3 py-1.5 text-left text-sm"
            classList={{
              "text-text-primary bg-accent/20": selectedCategory() === null,
              "text-text-secondary hover:text-text-primary hover:bg-bg-hover":
                selectedCategory() !== null,
            }}
            onClick={() => setSelectedCategory(null)}
          >
            All Settings
          </button>
          <For each={CATEGORIES}>
            {(category) => (
              <button
                class="w-full px-3 py-1.5 text-left text-sm"
                classList={{
                  "text-text-primary bg-accent/20": selectedCategory() === category,
                  "text-text-secondary hover:text-text-primary hover:bg-bg-hover":
                    selectedCategory() !== category,
                }}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            )}
          </For>
        </div>
      </div>

      {/* Main content */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* Search bar */}
        <div class="p-3 border-b border-border">
          <input
            type="text"
            class="w-full px-3 py-2 bg-bg-secondary border border-border rounded text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent"
            placeholder="Search settings..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
          />
        </div>

        {/* Settings list */}
        <div class="flex-1 overflow-auto">
          <Show
            when={!isLoading()}
            fallback={
              <div class="flex items-center justify-center h-full">
                <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <For each={Object.entries(groupedSettings())}>
              {([category, items]) => (
                <div class="border-b border-border/50">
                  {/* Category header */}
                  <div class="px-4 py-2 bg-bg-secondary text-sm font-medium text-text-secondary uppercase">
                    {category}
                  </div>

                  {/* Settings in category */}
                  <For each={items}>
                    {(item) => (
                      <div class="px-4 py-3 border-b border-border/30 hover:bg-bg-hover/50">
                        <div class="flex items-start justify-between gap-4">
                          <div class="flex-1">
                            <div class="flex items-center gap-2">
                              <span class="text-sm text-text-primary font-medium">
                                {item.label}
                              </span>
                              <Show when={modifiedKeys().has(item.key)}>
                                <span class="text-xs text-accent bg-accent/20 px-1.5 py-0.5 rounded">
                                  Modified
                                </span>
                              </Show>
                            </div>
                            <p class="text-xs text-text-tertiary mt-0.5">{item.description}</p>
                            <code class="text-xs text-text-tertiary mt-1 block">{item.key}</code>
                          </div>
                          <div class="shrink-0">{renderSettingControl(item)}</div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              )}
            </For>

            <Show when={filteredSettings().length === 0}>
              <div class="flex flex-col items-center justify-center h-64 text-text-tertiary">
                <span class="text-4xl mb-2">🔍</span>
                <span class="text-sm">No settings found</span>
              </div>
            </Show>
          </Show>
        </div>
      </div>
    </div>
  );
}
