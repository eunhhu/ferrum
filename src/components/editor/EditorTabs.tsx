import { For } from "solid-js";
import { editorStore } from "../../stores";

export function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = editorStore;

  return (
    <div class="h-9 bg-bg-secondary flex items-end border-b border-border overflow-x-auto">
      <For each={tabs}>
        {(tab) => (
          <div
            class={`group h-9 flex items-center gap-2 px-3 border-r border-border cursor-pointer ${
              activeTabId() === tab.id
                ? "bg-bg-primary text-text-active"
                : "bg-bg-tertiary text-text-secondary hover:bg-bg-hover"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span class="text-sm">{tab.fileName}</span>
            {tab.isDirty && (
              <span class="w-2 h-2 rounded-full bg-text-secondary group-hover:hidden" />
            )}
            <button
              class={`w-4 h-4 flex items-center justify-center rounded hover:bg-bg-active ${
                tab.isDirty ? "hidden group-hover:flex" : ""
              }`}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        )}
      </For>
    </div>
  );
}
