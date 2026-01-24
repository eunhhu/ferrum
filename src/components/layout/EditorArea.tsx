import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import * as ipc from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";
import type { ProjectInfo } from "../../ipc/types";
import { editorStore, filesStore } from "../../stores";
import { EditorTabs } from "../editor/EditorTabs";
import { EditorWithFeatures } from "../editor/EditorWithFeatures";

// Track initialized LSP servers to avoid duplicate starts
const initializedLspLanguages = new Set<string>();

// Auto-start LSP for a language
async function autoStartLsp(language: string, rootPath: string) {
  if (!isTauriEnvironment()) return;
  if (initializedLspLanguages.has(language)) return;

  try {
    const status = await ipc.lspStatus(language);
    if (!status.running) {
      await ipc.lspStart(language, rootPath);
      initializedLspLanguages.add(language);
      console.log(`LSP started for ${language}`);
    }
  } catch (e) {
    console.warn(`Failed to start LSP for ${language}:`, e);
  }
}

// Demo recent files for non-Tauri environment
const demoRecentFiles = [
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
  const { tabs, getActiveTab, updateContent, setCursorPosition, saveFile } = editorStore;

  // Auto-start LSP when active tab changes
  createEffect(() => {
    const tab = getActiveTab();
    if (tab?.language && tab.filePath) {
      const rootPath = filesStore.rootPath() || tab.filePath.split("/").slice(0, -1).join("/");

      // Map language to LSP language ID
      const lspLanguageMap: Record<string, string> = {
        typescript: "typescript",
        typescriptreact: "typescript",
        javascript: "typescript",
        javascriptreact: "typescript",
        rust: "rust",
        python: "python",
        go: "go",
        cpp: "cpp",
        c: "cpp",
      };

      const lspLanguage = lspLanguageMap[tab.language];
      if (lspLanguage) {
        autoStartLsp(lspLanguage, rootPath);
      }
    }
  });

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
                onSave={() => {
                  saveFile(tab().id);
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
  const [recentProjects, setRecentProjects] = createSignal<ProjectInfo[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = createSignal(false);

  // Load recent projects from backend
  onMount(async () => {
    if (!isTauriEnvironment()) return;

    setIsLoadingRecent(true);
    try {
      const projects = await ipc.getRecentProjects();
      setRecentProjects(projects);
    } catch (e) {
      console.warn("Failed to load recent projects:", e);
    } finally {
      setIsLoadingRecent(false);
    }
  });

  // Open a recent project
  const openRecentProject = async (project: ProjectInfo) => {
    try {
      await filesStore.openProject(project.path);
    } catch (e) {
      console.error("Failed to open project:", e);
    }
  };

  // Get display items - real projects or demo files
  const displayItems = () => {
    if (isTauriEnvironment() && recentProjects().length > 0) {
      return recentProjects().map((p) => ({
        name: p.name,
        path: p.path,
        isProject: true,
      }));
    }
    return demoRecentFiles.map((f) => ({ ...f, isProject: false }));
  };

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
          <Show when={isLoadingRecent()}>
            <div class="flex items-center justify-center py-4">
              <div class="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          </Show>
          <Show when={!isLoadingRecent()}>
            <div class="space-y-1">
              <For each={displayItems()}>
                {(item) => (
                  <button
                    class="w-full flex items-center gap-2 py-2 px-3 rounded hover:bg-bg-hover transition-colors text-left"
                    onClick={() => {
                      if (item.isProject) {
                        const project = recentProjects().find((p) => p.path === item.path);
                        if (project) openRecentProject(project);
                      } else {
                        // Demo mode - trigger file explorer
                        props.onOpenFolder();
                      }
                    }}
                  >
                    <svg class="w-4 h-4 text-text-tertiary" viewBox="0 0 24 24" fill="currentColor">
                      <Show
                        when={item.isProject}
                        fallback={
                          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                        }
                      >
                        <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
                      </Show>
                    </svg>
                    <span class="text-text-primary text-sm">{item.name}</span>
                    <span class="text-text-tertiary text-xs ml-auto truncate max-w-48">
                      {item.path}
                    </span>
                  </button>
                )}
              </For>
            </div>
          </Show>
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
