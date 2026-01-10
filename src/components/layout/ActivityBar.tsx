import { For } from "solid-js";
import { uiStore } from "../../stores";
import type { SidebarView } from "../../types";

interface ActivityItem {
  id: SidebarView;
  icon: string;
  label: string;
}

const activities: ActivityItem[] = [
  { id: "explorer", icon: "files", label: "Explorer" },
  { id: "search", icon: "search", label: "Search" },
  { id: "git", icon: "git", label: "Source Control" },
  { id: "extensions", icon: "extensions", label: "Extensions" },
];

function ActivityIcon(props: { type: string }) {
  const icons: Record<string, string> = {
    files: "M3 4h18v16H3V4zm2 2v12h14V6H5z",
    search: "M10 2a8 8 0 105.293 14.707l4 4 1.414-1.414-4-4A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z",
    git: "M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z",
    extensions: "M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-2 .9-2 2v3.8h1.5c1.38 0 2.5 1.12 2.5 2.5s-1.12 2.5-2.5 2.5H2V19c0 1.1.9 2 2 2h3.8v-1.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5V21H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z",
  };

  return (
    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d={icons[props.type] || icons["files"]} />
    </svg>
  );
}

export function ActivityBar() {
  const { sidebarView, setSidebarView, sidebarVisible, toggleSidebar } = uiStore;

  const handleClick = (id: SidebarView) => {
    if (sidebarView() === id && sidebarVisible()) {
      toggleSidebar();
    } else {
      setSidebarView(id);
      if (!sidebarVisible()) toggleSidebar();
    }
  };

  return (
    <div class="w-12 bg-bg-secondary flex flex-col items-center py-1 border-r border-border">
      <For each={activities}>
        {(item) => (
          <button
            class={`w-12 h-12 flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors relative ${
              sidebarView() === item.id && sidebarVisible()
                ? "text-text-active before:absolute before:left-0 before:top-0 before:bottom-0 before:w-0.5 before:bg-accent"
                : ""
            }`}
            onClick={() => handleClick(item.id)}
            title={item.label}
          >
            <ActivityIcon type={item.icon} />
          </button>
        )}
      </For>
    </div>
  );
}
