import { Match, Show, Switch } from "solid-js";
import { uiStore } from "../../stores";
import { FileExplorer } from "../explorer/FileExplorer";

export function Sidebar() {
  const { sidebarVisible, sidebarView, sidebarWidth } = uiStore;

  return (
    <Show when={sidebarVisible()}>
      <div
        class="bg-bg-secondary border-r border-border flex flex-col"
        style={{ width: `${sidebarWidth()}px` }}
      >
        <div class="h-9 flex items-center px-4 text-xs uppercase tracking-wider text-text-secondary font-medium">
          {sidebarView()}
        </div>
        <div class="flex-1 overflow-auto">
          <Switch fallback={<div class="p-4 text-text-secondary">Not implemented</div>}>
            <Match when={sidebarView() === "explorer"}>
              <FileExplorer />
            </Match>
            <Match when={sidebarView() === "search"}>
              <div class="p-4 text-text-secondary">Search (coming soon)</div>
            </Match>
            <Match when={sidebarView() === "git"}>
              <div class="p-4 text-text-secondary">Source Control (coming soon)</div>
            </Match>
            <Match when={sidebarView() === "extensions"}>
              <div class="p-4 text-text-secondary">Extensions (coming soon)</div>
            </Match>
          </Switch>
        </div>
      </div>
    </Show>
  );
}
