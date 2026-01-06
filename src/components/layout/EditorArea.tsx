import { Show } from "solid-js";
import { editorStore } from "../../stores";
import { EditorTabs } from "../editor/EditorTabs";

export function EditorArea() {
  const { tabs, getActiveTab } = editorStore;

  return (
    <div class="flex-1 flex flex-col bg-bg-primary min-w-0">
      <Show
        when={tabs.length > 0}
        fallback={
          <div class="flex-1 flex items-center justify-center text-text-secondary">
            <div class="text-center">
              <div class="text-6xl mb-4 opacity-20">Fe</div>
              <div class="text-lg">Ferrum IDE</div>
              <div class="text-sm mt-2">Open a file to start editing</div>
            </div>
          </div>
        }
      >
        <EditorTabs />
        <div class="flex-1 overflow-auto p-4 font-mono text-sm">
          <Show when={getActiveTab()}>
            {(tab) => (
              <pre class="whitespace-pre-wrap text-text-primary">
                {tab().content || "Empty file"}
              </pre>
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
