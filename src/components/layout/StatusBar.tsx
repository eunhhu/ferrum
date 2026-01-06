import { Show } from "solid-js";
import { editorStore } from "../../stores";

export function StatusBar() {
  const { getActiveTab, cursorPosition } = editorStore;

  return (
    <div class="h-6 bg-accent flex items-center justify-between px-2 text-xs text-white">
      <div class="flex items-center gap-4">
        <span>Ferrum IDE</span>
      </div>
      <div class="flex items-center gap-4">
        <Show when={getActiveTab()}>
          {(tab) => (
            <>
              <span>
                Ln {cursorPosition().line}, Col {cursorPosition().column}
              </span>
              <span>{tab().language}</span>
            </>
          )}
        </Show>
        <span>UTF-8</span>
      </div>
    </div>
  );
}
