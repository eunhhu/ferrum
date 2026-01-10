import { Show } from "solid-js";
import { editorStore } from "../../stores";
import { EditorTabs } from "../editor/EditorTabs";
import { Editor } from "../editor/Editor";

export function EditorArea() {
  const { tabs, getActiveTab, updateContent, setCursorPosition } = editorStore;

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
        <div class="flex-1 overflow-hidden">
          <Show when={getActiveTab()}>
            {(tab) => (
              <Editor
                bufferId={tab().bufferId || tab().id}
                content={tab().content || ""}
                language={tab().language}
                onContentChange={(content) => {
                  updateContent(tab().id, content);
                }}
                onCursorChange={(line, column) => {
                  setCursorPosition({ line, column });
                }}
              />
            )}
          </Show>
        </div>
      </Show>
    </div>
  );
}
