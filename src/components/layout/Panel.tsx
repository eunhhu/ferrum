import { Show, createSignal } from "solid-js";
import { uiStore } from "../../stores";

type PanelTabType = "terminal" | "output" | "problems";

export function Panel() {
  const { panelVisible, panelHeight } = uiStore;
  const [activeTab, setActiveTab] = createSignal<PanelTabType>("terminal");

  const tabs: { id: PanelTabType; label: string }[] = [
    { id: "problems", label: "Problems" },
    { id: "output", label: "Output" },
    { id: "terminal", label: "Terminal" },
  ];

  return (
    <Show when={panelVisible()}>
      <div
        class="bg-bg-secondary border-t border-border flex flex-col"
        style={{ height: `${panelHeight()}px` }}
      >
        <div class="h-9 flex items-center border-b border-border px-2">
          {tabs.map((tab) => (
            <button
              class={`px-3 h-full text-xs uppercase tracking-wider transition-colors ${
                activeTab() === tab.id
                  ? "text-text-active border-b-2 border-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div class="flex-1 overflow-auto p-2 font-mono text-sm">
          <Show when={activeTab() === "terminal"}>
            <div class="text-text-secondary">Terminal ready</div>
          </Show>
          <Show when={activeTab() === "output"}>
            <div class="text-text-secondary">No output</div>
          </Show>
          <Show when={activeTab() === "problems"}>
            <div class="text-text-secondary">No problems detected</div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
