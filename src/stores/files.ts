import { createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { FileNode } from "../types";

const [rootPath, setRootPath] = createSignal<string | null>(null);
const [fileTree, setFileTree] = createStore<FileNode[]>([]);
const [selectedPath, setSelectedPath] = createSignal<string | null>(null);

export const filesStore = {
  rootPath,
  setRootPath,
  fileTree,
  setFileTree,
  selectedPath,
  setSelectedPath,

  toggleExpand: (path: string) => {
    function toggleInTree(nodes: FileNode[]): FileNode[] {
      return nodes.map((node) => {
        if (node.path === path) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: toggleInTree(node.children) };
        }
        return node;
      });
    }
    setFileTree(toggleInTree([...fileTree]));
  },
};
