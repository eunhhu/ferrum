/**
 * Unified AI Panel
 *
 * A combined AI panel that allows switching between cloud (OpenRouter)
 * and local (Ollama) AI providers.
 */

import { createSignal, Show } from "solid-js";
import { AiChatPanel } from "./AiChatPanel";
import { LocalAiPanel } from "./LocalAiPanel";

export type AiPanelMode = "cloud" | "local";

interface UnifiedAiPanelProps {
  onInsertCode?: (code: string) => void;
  selectedCode?: string;
  defaultMode?: AiPanelMode;
}

export function UnifiedAiPanel(props: UnifiedAiPanelProps) {
  const [mode, setMode] = createSignal<AiPanelMode>(
    props.defaultMode || (localStorage.getItem("ferrum_ai_panel_mode") as AiPanelMode) || "cloud"
  );

  const handleModeChange = (newMode: AiPanelMode) => {
    setMode(newMode);
    localStorage.setItem("ferrum_ai_panel_mode", newMode);
  };

  return (
    <div class="unified-ai-panel h-full flex flex-col bg-bg-primary">
      {/* Mode Toggle */}
      <div class="flex items-center px-3 py-2 border-b border-border bg-bg-secondary/50">
        <div class="flex rounded-lg overflow-hidden border border-border">
          <button
            class="px-3 py-1 text-xs font-medium transition-colors"
            classList={{
              "bg-accent text-white": mode() === "cloud",
              "bg-transparent text-text-secondary hover:text-text-primary": mode() !== "cloud",
            }}
            onClick={() => handleModeChange("cloud")}
          >
            ☁️ Cloud
          </button>
          <button
            class="px-3 py-1 text-xs font-medium transition-colors border-l border-border"
            classList={{
              "bg-green-600 text-white": mode() === "local",
              "bg-transparent text-text-secondary hover:text-text-primary": mode() !== "local",
            }}
            onClick={() => handleModeChange("local")}
          >
            🖥️ Local
          </button>
        </div>
        <div class="ml-auto text-[10px] text-text-quaternary">
          {mode() === "cloud" ? "OpenRouter API" : "Ollama"}
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-hidden">
        <Show when={mode() === "cloud"}>
          <AiChatPanel
            {...(props.onInsertCode ? { onInsertCode: props.onInsertCode } : {})}
            {...(props.selectedCode ? { selectedCode: props.selectedCode } : {})}
          />
        </Show>
        <Show when={mode() === "local"}>
          <LocalAiPanel
            {...(props.onInsertCode ? { onInsertCode: props.onInsertCode } : {})}
            {...(props.selectedCode ? { selectedCode: props.selectedCode } : {})}
          />
        </Show>
      </div>
    </div>
  );
}
