import { Show, createSignal, For } from "solid-js";
import { uiStore } from "../../stores";

type PanelTabType = "terminal" | "output" | "problems" | "debug";

interface PanelTab {
  id: PanelTabType;
  label: string;
  badge?: number;
}

export function Panel() {
  const { panelVisible, panelHeight, togglePanel, setPanelHeight } = uiStore;
  const [activeTab, setActiveTab] = createSignal<PanelTabType>("terminal");
  const [isResizing, setIsResizing] = createSignal(false);

  // Demo problems for display
  const [problems] = createSignal([
    {
      type: "error",
      file: "src/main.tsx",
      line: 15,
      message: "Cannot find name 'undefined_var'",
    },
    {
      type: "warning",
      file: "src/utils/api.ts",
      line: 23,
      message: "'response' is defined but never used",
    },
  ]);

  const tabs: PanelTab[] = [
    { id: "problems", label: "Problems", badge: problems().length },
    { id: "output", label: "Output" },
    { id: "terminal", label: "Terminal" },
    { id: "debug", label: "Debug Console" },
  ];

  // Handle resize
  const handleMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = panelHeight();

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startY - e.clientY;
      const newHeight = Math.max(100, Math.min(600, startHeight + delta));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <Show when={panelVisible()}>
      <div
        class="bg-bg-secondary border-t border-border flex flex-col"
        style={{ height: `${panelHeight()}px` }}
      >
        {/* Resize Handle */}
        <div
          class="h-1 cursor-ns-resize hover:bg-accent/50 transition-colors"
          classList={{ "bg-accent": isResizing() }}
          onMouseDown={handleMouseDown}
        />

        {/* Tab Bar */}
        <div class="h-9 flex items-center border-b border-border px-2">
          <For each={tabs}>
            {(tab) => (
              <button
                class="px-3 h-full text-xs uppercase tracking-wider transition-colors flex items-center gap-1"
                classList={{
                  "text-text-active border-b-2 border-accent":
                    activeTab() === tab.id,
                  "text-text-secondary hover:text-text-primary":
                    activeTab() !== tab.id,
                }}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                <Show when={tab.badge && tab.badge > 0}>
                  <span class="px-1.5 py-0.5 bg-error text-white text-[10px] rounded-full">
                    {tab.badge}
                  </span>
                </Show>
              </button>
            )}
          </For>
          <div class="flex-1" />

          {/* Panel Actions */}
          <div class="flex items-center gap-1">
            <button
              class="p-1 hover:bg-bg-hover rounded transition-colors"
              title="Maximize Panel"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
              </svg>
            </button>
            <button
              class="p-1 hover:bg-bg-hover rounded transition-colors"
              onClick={togglePanel}
              title="Close Panel"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto">
          <Show when={activeTab() === "terminal"}>
            <TerminalContent />
          </Show>
          <Show when={activeTab() === "output"}>
            <OutputContent />
          </Show>
          <Show when={activeTab() === "problems"}>
            <ProblemsContent problems={problems()} />
          </Show>
          <Show when={activeTab() === "debug"}>
            <DebugContent />
          </Show>
        </div>
      </div>
    </Show>
  );
}

function TerminalContent() {
  const [history, setHistory] = createSignal<string[]>([
    "Welcome to Ferrum IDE Terminal",
    "Type 'help' for available commands",
    "",
  ]);
  const [input, setInput] = createSignal("");
  let inputRef: HTMLInputElement | undefined;

  const handleCommand = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const newHistory = [...history(), `$ ${trimmed}`];

    switch (trimmed) {
      case "help":
        newHistory.push(
          "Available commands:",
          "  help    - Show this help",
          "  clear   - Clear terminal",
          "  version - Show version",
          "  pwd     - Print working directory",
          ""
        );
        break;
      case "clear":
        setHistory([]);
        setInput("");
        return;
      case "version":
        newHistory.push("Ferrum IDE v0.1.0", "");
        break;
      case "pwd":
        newHistory.push("/demo/my-app", "");
        break;
      default:
        newHistory.push(`Command not found: ${trimmed}`, "");
    }

    setHistory(newHistory);
    setInput("");
  };

  return (
    <div
      class="h-full p-2 font-mono text-sm bg-bg-primary cursor-text"
      onClick={() => inputRef?.focus()}
    >
      <For each={history()}>
        {(line) => (
          <div class="text-text-secondary whitespace-pre">
            {line || "\u00A0"}
          </div>
        )}
      </For>
      <div class="flex items-center">
        <span class="text-accent mr-2">$</span>
        <input
          ref={inputRef}
          type="text"
          class="flex-1 bg-transparent outline-none text-text-primary"
          value={input()}
          onInput={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleCommand(input());
            }
          }}
          autofocus
        />
      </div>
    </div>
  );
}

function OutputContent() {
  const logs = [
    { time: "10:23:45", type: "info", message: "Build started..." },
    { time: "10:23:46", type: "info", message: "Compiling 23 modules..." },
    { time: "10:23:48", type: "success", message: "Build completed in 2.3s" },
    {
      time: "10:24:01",
      type: "info",
      message: "Development server started on http://localhost:3000",
    },
  ];

  return (
    <div class="p-2 font-mono text-xs">
      <For each={logs}>
        {(log) => (
          <div class="flex gap-2 py-0.5">
            <span class="text-text-tertiary">[{log.time}]</span>
            <span
              classList={{
                "text-info": log.type === "info",
                "text-success": log.type === "success",
                "text-error": log.type === "error",
              }}
            >
              {log.message}
            </span>
          </div>
        )}
      </For>
    </div>
  );
}

function ProblemsContent(props: {
  problems: Array<{
    type: string;
    file: string;
    line: number;
    message: string;
  }>;
}) {
  return (
    <div class="p-2">
      <Show
        when={props.problems.length > 0}
        fallback={
          <div class="text-text-secondary text-sm py-4 text-center">
            No problems detected
          </div>
        }
      >
        <For each={props.problems}>
          {(problem) => (
            <div class="flex items-start gap-2 py-1 px-2 hover:bg-bg-hover rounded cursor-pointer">
              <Show when={problem.type === "error"}>
                <svg
                  class="w-4 h-4 text-error flex-shrink-0 mt-0.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              </Show>
              <Show when={problem.type === "warning"}>
                <svg
                  class="w-4 h-4 text-warning flex-shrink-0 mt-0.5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                </svg>
              </Show>
              <div class="flex-1 min-w-0">
                <div class="text-sm text-text-primary">{problem.message}</div>
                <div class="text-xs text-text-tertiary">
                  {problem.file}:{problem.line}
                </div>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

function DebugContent() {
  return (
    <div class="p-4 text-text-secondary text-sm text-center">
      <svg
        class="w-12 h-12 mx-auto mb-2 opacity-30"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M20 8h-2.81a5.985 5.985 0 0 0-1.82-1.96L17 4.41 15.59 3l-2.17 2.17C12.96 5.06 12.49 5 12 5c-.49 0-.96.06-1.41.17L8.41 3 7 4.41l1.62 1.63C7.88 6.55 7.26 7.22 6.81 8H4v2h2.09c-.05.33-.09.66-.09 1v1H4v2h2v1c0 .34.04.67.09 1H4v2h2.81c1.04 1.79 2.97 3 5.19 3s4.15-1.21 5.19-3H20v-2h-2.09c.05-.33.09-.66.09-1v-1h2v-2h-2v-1c0-.34-.04-.67-.09-1H20V8zm-6 8h-4v-2h4v2zm0-4h-4v-2h4v2z" />
      </svg>
      <p>No debug session active</p>
      <p class="text-xs mt-1">Run a debug configuration to see output here</p>
    </div>
  );
}
