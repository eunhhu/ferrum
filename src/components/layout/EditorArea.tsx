import { For, Show } from "solid-js";
import { editorStore } from "../../stores";
import { EditorTabs } from "../editor/EditorTabs";
import { EditorWithFeatures } from "../editor/EditorWithFeatures";

// Recent files for welcome screen (demo)
const recentFiles = [
  { name: "App.tsx", path: "/demo/src/components/App.tsx" },
  { name: "main.tsx", path: "/demo/src/main.tsx" },
  { name: "package.json", path: "/demo/package.json" },
];

// Keyboard shortcuts to display
const shortcuts = [
  { label: "Command Palette", keys: "⌘ ⇧ P" },
  { label: "Quick Open", keys: "⌘ P" },
  { label: "Toggle Sidebar", keys: "⌘ B" },
  { label: "Toggle Terminal", keys: "⌘ J" },
  { label: "New File", keys: "⌘ N" },
  { label: "Save", keys: "⌘ S" },
];

export function EditorArea() {
  const { tabs, getActiveTab, updateContent, setCursorPosition } = editorStore;

  const handleOpenFolder = async () => {
    // Trigger file explorer open folder
    const explorer = document.querySelector('[title="Open Folder"]') as HTMLButtonElement;
    explorer?.click();
  };

  return (
    <div class="flex-1 flex flex-col bg-bg-primary min-w-0">
      <Show when={tabs.length > 0} fallback={<WelcomeScreen onOpenFolder={handleOpenFolder} />}>
        <EditorTabs />
        <div class="flex-1 overflow-hidden">
          <Show when={getActiveTab()}>
            {(tab) => (
              <EditorWithFeatures
                bufferId={tab().bufferId || tab().id}
                content={tab().content || ""}
                language={tab().language}
                filePath={tab().filePath}
                onContentChange={(content) => {
                  updateContent(tab().id, content);
                }}
                onCursorChange={(line, column) => {
                  setCursorPosition({ line, column });
                }}
              />
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}

function WelcomeScreen(props: { onOpenFolder: () => void }) {
  return (
    <div class="flex-1 flex items-center justify-center">
      <div class="max-w-lg w-full px-8">
        {/* Logo */}
        <div class="text-center mb-8">
          <div class="text-7xl font-bold text-accent mb-2 opacity-80">Fe</div>
          <h1 class="text-2xl font-semibold text-text-primary">Ferrum IDE</h1>
          <p class="text-text-secondary mt-1">High-Performance Code Editor</p>
        </div>

        {/* Actions */}
        <div class="space-y-3 mb-8">
          <h2 class="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">
            Start
          </h2>
          <button
            class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-bg-hover transition-colors text-left"
            onClick={props.onOpenFolder}
          >
            <div class="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-accent" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
              </svg>
            </div>
            <div>
              <div class="text-text-primary font-medium">Open Folder</div>
              <div class="text-text-tertiary text-sm">Open a project directory</div>
            </div>
          </button>
          <button class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-bg-hover transition-colors text-left">
            <div class="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
              <svg class="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z" />
              </svg>
            </div>
            <div>
              <div class="text-text-primary font-medium">New File</div>
              <div class="text-text-tertiary text-sm">Create a new untitled file</div>
            </div>
          </button>
          <button class="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-bg-hover transition-colors text-left">
            <div class="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
              <svg class="w-5 h-5 text-text-secondary" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
              </svg>
            </div>
            <div>
              <div class="text-text-primary font-medium">Clone Repository</div>
              <div class="text-text-tertiary text-sm">Clone from Git URL</div>
            </div>
          </button>
        </div>

        {/* Recent */}
        <div class="mb-8">
          <h2 class="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">
            Recent
          </h2>
          <div class="space-y-1">
            <For each={recentFiles}>
              {(file) => (
                <button
                  class="w-full flex items-center gap-2 py-2 px-3 rounded hover:bg-bg-hover transition-colors text-left"
                  onClick={() => {
                    // Open recent file
                  }}
                >
                  <svg class="w-4 h-4 text-text-tertiary" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                  </svg>
                  <span class="text-text-primary text-sm">{file.name}</span>
                  <span class="text-text-tertiary text-xs ml-auto">{file.path}</span>
                </button>
              )}
            </For>
          </div>
        </div>

        {/* Shortcuts */}
        <div>
          <h2 class="text-sm font-medium text-text-secondary uppercase tracking-wider mb-2">
            Keyboard Shortcuts
          </h2>
          <div class="grid grid-cols-2 gap-2">
            <For each={shortcuts}>
              {(shortcut) => (
                <div class="flex items-center justify-between py-1">
                  <span class="text-text-secondary text-sm">{shortcut.label}</span>
                  <kbd class="px-2 py-0.5 bg-bg-tertiary text-text-tertiary text-xs rounded font-mono">
                    {shortcut.keys}
                  </kbd>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}
