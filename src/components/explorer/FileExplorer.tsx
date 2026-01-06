import { For, Show } from "solid-js";
import { filesStore, editorStore } from "../../stores";
import type { FileNode } from "../../types";

function FileIcon(props: { type: "file" | "directory"; isExpanded?: boolean }) {
  if (props.type === "directory") {
    return (
      <svg class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor">
        <path
          d={
            props.isExpanded
              ? "M19 9H5l7 7 7-7z"
              : "M9 5l7 7-7 7V5z"
          }
        />
      </svg>
    );
  }
  return (
    <svg class="w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
    </svg>
  );
}

function FileTreeItem(props: { node: FileNode; depth: number }) {
  const { toggleExpand, selectedPath, setSelectedPath } = filesStore;

  const handleClick = () => {
    if (props.node.type === "directory") {
      toggleExpand(props.node.path);
    } else {
      setSelectedPath(props.node.path);
      editorStore.openFile(props.node.path, `// Content of ${props.node.name}`);
    }
  };

  return (
    <>
      <div
        class={`flex items-center gap-1 px-2 py-0.5 cursor-pointer hover:bg-bg-hover ${
          selectedPath() === props.node.path ? "bg-bg-active" : ""
        }`}
        style={{ "padding-left": `${props.depth * 12 + 8}px` }}
        onClick={handleClick}
      >
        <FileIcon type={props.node.type} isExpanded={props.node.isExpanded} />
        <span class="text-text-primary text-sm truncate">{props.node.name}</span>
      </div>
      <Show when={props.node.type === "directory" && props.node.isExpanded}>
        <For each={props.node.children}>
          {(child) => <FileTreeItem node={child} depth={props.depth + 1} />}
        </For>
      </Show>
    </>
  );
}

export function FileExplorer() {
  const { fileTree } = filesStore;

  return (
    <div class="py-1">
      <Show
        when={fileTree.length > 0}
        fallback={
          <div class="px-4 py-2 text-text-secondary text-sm">
            No folder opened
          </div>
        }
      >
        <For each={fileTree}>
          {(node) => <FileTreeItem node={node} depth={0} />}
        </For>
      </Show>
    </div>
  );
}
