import { For, Show, createSignal } from "solid-js";
import { filesStore, editorStore } from "../../stores";
import type { FileNode } from "../../types";
import * as ipc from "../../ipc/commands";

// File extension to icon color mapping
const extColors: Record<string, string> = {
  ts: "#3178c6",
  tsx: "#3178c6",
  js: "#f7df1e",
  jsx: "#f7df1e",
  rs: "#dea584",
  py: "#3572a5",
  go: "#00add8",
  json: "#cbcb41",
  md: "#083fa1",
  html: "#e34c26",
  css: "#563d7c",
  toml: "#9c4221",
};

function FileIcon(props: { name: string; type: "file" | "directory"; isExpanded?: boolean | undefined }) {
  const isDirectory = () => props.type === "directory";
  const ext = () => props.name.split(".").pop()?.toLowerCase() || "";
  const color = () => extColors[ext()] || "#9da5b4";

  return (
    <Show
      when={isDirectory()}
      fallback={
        <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill={color()}>
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
        </svg>
      }
    >
      <svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <Show
          when={props.isExpanded}
          fallback={
            <path fill="#dcb67a" d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          }
        >
          <path fill="#dcb67a" d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
        </Show>
      </svg>
    </Show>
  );
}

function FileTreeItem(props: { node: FileNode; depth: number }) {
  const { toggleExpand, selectedPath, setSelectedPath } = filesStore;
  const [isLoading, setIsLoading] = createSignal(false);

  const handleClick = async () => {
    if (props.node.type === "directory") {
      setIsLoading(true);
      try {
        await toggleExpand(props.node.path);
      } finally {
        setIsLoading(false);
      }
    } else {
      setSelectedPath(props.node.path);
      try {
        const file = await ipc.readFile(props.node.path);
        editorStore.openFile(props.node.path, file.content);
      } catch (e) {
        console.error("Failed to open file:", e);
      }
    }
  };

  const handleDoubleClick = () => {
    if (props.node.type === "file") {
      // Pin the tab on double click
    }
  };

  return (
    <>
      <div
        class="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-bg-hover transition-colors"
        classList={{
          "bg-bg-active": selectedPath() === props.node.path,
          "opacity-50": props.node.isHidden,
        }}
        style={{ "padding-left": `${props.depth * 12 + 8}px` }}
        onClick={handleClick}
        onDblClick={handleDoubleClick}
      >
        <Show when={isLoading()}>
          <div class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </Show>
        <Show when={!isLoading()}>
          <FileIcon
            name={props.node.name}
            type={props.node.type}
            isExpanded={props.node.isExpanded}
          />
        </Show>
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
  const { fileTree, projectInfo, isLoading } = filesStore;

  return (
    <div class="py-1 h-full overflow-auto">
      <Show when={isLoading()}>
        <div class="flex items-center justify-center py-4">
          <div class="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Show>
      <Show when={!isLoading()}>
        <Show
          when={fileTree.length > 0}
          fallback={
            <div class="px-4 py-2 text-text-secondary text-sm">
              <p>No folder opened</p>
              <p class="text-xs mt-1">Use File &gt; Open Folder to get started</p>
            </div>
          }
        >
          <Show when={projectInfo()}>
            <div class="px-2 py-1 text-xs text-text-secondary uppercase tracking-wide font-medium">
              {projectInfo()?.name}
              <Show when={projectInfo()?.has_git}>
                <span class="ml-1 text-accent">(git)</span>
              </Show>
            </div>
          </Show>
          <For each={fileTree}>
            {(node) => <FileTreeItem node={node} depth={0} />}
          </For>
        </Show>
      </Show>
    </div>
  );
}
