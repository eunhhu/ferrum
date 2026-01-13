/**
 * View Mode Toggle Component
 *
 * Allows switching between Code view and Visual view modes.
 * Code view: Traditional text editor
 * Visual view: Node-based visual representation of code structure
 */

import { createSignal, Show, type JSX } from "solid-js";

export type ViewMode = "code" | "visual" | "split";

interface ViewModeToggleProps {
  currentMode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  visualAvailable?: boolean;
}

export function ViewModeToggle(props: ViewModeToggleProps) {
  const [isHovered, setIsHovered] = createSignal(false);

  const modes: { id: ViewMode; label: string; icon: string; shortcut: string }[] = [
    { id: "code", label: "Code", icon: "{ }", shortcut: "⌘1" },
    { id: "visual", label: "Visual", icon: "◇", shortcut: "⌘2" },
    { id: "split", label: "Split", icon: "⊞", shortcut: "⌘3" },
  ];

  return (
    <div
      class="view-mode-toggle flex items-center gap-1 bg-bg-secondary rounded-lg p-1 border border-border"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {modes.map((mode) => (
        <button
          class="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-150"
          classList={{
            "bg-accent text-white shadow-sm": props.currentMode === mode.id,
            "text-text-secondary hover:text-text-primary hover:bg-bg-hover":
              props.currentMode !== mode.id,
            "opacity-50 cursor-not-allowed":
              mode.id === "visual" && !props.visualAvailable,
          }}
          onClick={() => {
            if (mode.id === "visual" && !props.visualAvailable) return;
            props.onModeChange(mode.id);
          }}
          disabled={mode.id === "visual" && !props.visualAvailable}
          title={`${mode.label} View (${mode.shortcut})`}
        >
          <span class="font-mono">{mode.icon}</span>
          <Show when={isHovered()}>
            <span class="whitespace-nowrap">{mode.label}</span>
          </Show>
        </button>
      ))}
    </div>
  );
}

interface ViewModeContainerProps {
  mode: ViewMode;
  codeView: () => JSX.Element;
  visualView: () => JSX.Element;
}

export function ViewModeContainer(props: ViewModeContainerProps) {
  return (
    <div class="view-mode-container flex-1 flex overflow-hidden">
      {/* Code View */}
      <Show when={props.mode === "code" || props.mode === "split"}>
        <div
          class="code-view flex-1 overflow-hidden"
          classList={{
            "border-r border-border": props.mode === "split",
          }}
        >
          {props.codeView()}
        </div>
      </Show>

      {/* Visual View */}
      <Show when={props.mode === "visual" || props.mode === "split"}>
        <div class="visual-view flex-1 overflow-hidden bg-bg-tertiary">
          {props.visualView()}
        </div>
      </Show>
    </div>
  );
}
