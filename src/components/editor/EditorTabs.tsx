import { For, Show } from "solid-js";
import { editorStore } from "../../stores";

// File extension to icon color mapping
const extColors: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#f7df1e",
  jsx: "#f7df1e",
  rs: "#dea584",
  py: "#3572a5",
  go: "#00add8",
  json: "#cbcb41",
  md: "#083fa1",
  html: "#e34c26",
  css: "#563d7c",
  toml: "#9c4221",
};

function FileIcon(props: { name: string }) {
  const ext = () => props.name.split(".").pop()?.toLowerCase() || "";
  const color = () => extColors[ext()] || "#9da5b4";

  return (
    <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill={color()}>
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
    </svg>
  );
}

export function EditorTabs() {
  const { tabs, activeTabId, setActiveTab, closeTab } = editorStore;

  return (
    <div class="h-9 bg-bg-secondary flex items-end border-b border-border">
      <div class="flex-1 flex items-end overflow-x-auto scrollbar-thin">
        <For each={tabs}>
          {(tab) => (
            <div
              class="group h-9 flex items-center gap-2 px-3 border-r border-border cursor-pointer min-w-0 max-w-[200px] transition-colors"
              classList={{
                "bg-bg-primary text-text-active": activeTabId() === tab.id,
                "bg-bg-tertiary text-text-secondary hover:bg-bg-hover":
                  activeTabId() !== tab.id,
              }}
              onClick={() => setActiveTab(tab.id)}
              onMouseDown={(e) => {
                // Middle click to close
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              title={tab.filePath}
            >
              <FileIcon name={tab.fileName} />
              <span class="text-sm truncate">{tab.fileName}</span>
              <Show when={tab.isDirty}>
                <span class="w-2 h-2 rounded-full bg-accent flex-shrink-0 group-hover:hidden" />
              </Show>
              <button
                class="w-4 h-4 flex items-center justify-center rounded hover:bg-bg-active flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                classList={{
                  "opacity-100": tab.isDirty,
                  "hidden group-hover:flex": tab.isDirty,
                }}
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

      {/* Tab Actions */}
      <div class="flex items-center h-9 px-1 border-l border-border bg-bg-secondary">
        <button
          class="p-1 hover:bg-bg-hover rounded transition-colors"
          title="Split Editor Right"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 5v14h18V5H3zm8 12H5V7h6v10zm8 0h-6V7h6v10z" />
          </svg>
        </button>
        <button
          class="p-1 hover:bg-bg-hover rounded transition-colors"
          title="More Actions"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
