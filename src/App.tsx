/**
 * Ferrum IDE - Main Application
 *
 * A high-performance code editor built with Tauri, SolidJS, and Rust.
 * Features a modern IDE layout with activity bar, sidebar, editor area,
 * and bottom panel.
 */

import { onMount, createEffect, Show } from "solid-js";
import { ActivityBar } from "./components/layout/ActivityBar";
import { Sidebar } from "./components/layout/Sidebar";
import { EditorArea } from "./components/layout/EditorArea";
import { Panel } from "./components/layout/Panel";
import { StatusBar } from "./components/layout/StatusBar";
import { CommandPalette } from "./components/ui/CommandPalette";
import { TreeViewer } from "./components/tree-viewer/TreeViewer";
import { StickyHeader } from "./components/tree-viewer/StickyHeader";
import { uiStore, editorStore, commandsStore } from "./stores";
import type { ScopeInfo } from "./ipc/types";
import { createSignal } from "solid-js";

function App() {
  const [commandPaletteOpen, setCommandPaletteOpen] = createSignal(false);
  const [currentLine] = createSignal(0);
  const [scopes, setScopes] = createSignal<ScopeInfo[]>([]);

  // Register global keyboard shortcuts
  onMount(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Command Palette: Cmd/Ctrl + Shift + P
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "p") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Quick Open: Cmd/Ctrl + P
      if ((e.metaKey || e.ctrlKey) && e.key === "p" && !e.shiftKey) {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }

      // Toggle Sidebar: Cmd/Ctrl + B
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        uiStore.toggleSidebar();
        return;
      }

      // Toggle Panel: Cmd/Ctrl + J
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        uiStore.togglePanel();
        return;
      }

      // Close Tab: Cmd/Ctrl + W
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        const activeTab = editorStore.getActiveTab();
        if (activeTab) {
          editorStore.closeTab(activeTab.id);
        }
        return;
      }

      // Save: Cmd/Ctrl + S
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const activeTab = editorStore.getActiveTab();
        if (activeTab) {
          // Save logic would go here
          editorStore.markSaved(activeTab.id);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  // Update scopes when active tab changes (mock data for now)
  createEffect(() => {
    const activeTab = editorStore.getActiveTab();
    if (
      activeTab?.language === "typescript" ||
      activeTab?.language === "typescriptreact"
    ) {
      // In production, this would come from tree-sitter analysis
      setScopes([]);
    } else {
      setScopes([]);
    }
  });

  const handleScopeClick = (scope: ScopeInfo) => {
    // Scroll to scope start line
    const scrollFn = (
      window as { __ferrum_editor_scrollToLine?: (line: number) => void }
    ).__ferrum_editor_scrollToLine;
    if (typeof scrollFn === "function") {
      scrollFn(scope.start_line);
    }
  };

  return (
    <div
      class="h-screen w-screen bg-bg-primary text-text-primary flex flex-col overflow-hidden"
      data-testid="app"
    >
      {/* Main Content Area */}
      <div class="flex-1 flex overflow-hidden">
        {/* Activity Bar */}
        <Show when={uiStore.activityBarVisible()}>
          <ActivityBar />
        </Show>

        {/* Sidebar */}
        <Sidebar />

        {/* Editor Area with Tree Viewer */}
        <div class="flex-1 relative overflow-hidden" data-testid="editor-area">
          {/* Sticky Headers */}
          <Show when={scopes().length > 0}>
            <StickyHeader
              scopes={scopes()}
              currentLine={currentLine()}
              onScopeClick={handleScopeClick}
            />
          </Show>

          {/* Main Editor */}
          <EditorArea />

          {/* Tree Viewer Overlay */}
          <Show when={editorStore.getActiveTab()}>
            {(tab) => (
              <TreeViewer
                bufferId={tab().bufferId || tab().id}
                lineCount={(tab().content || "").split("\n").length}
              />
            )}
          </Show>
        </div>
      </div>

      {/* Bottom Panel */}
      <Panel />

      {/* Status Bar */}
      <StatusBar />

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen()}
        onClose={() => setCommandPaletteOpen(false)}
        commands={commandsStore.commands}
      />
    </div>
  );
}

export default App;
