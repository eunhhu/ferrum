import { batch, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import * as ipc from "../ipc/commands";
import type { FileNode, FileTreeNode, ProjectInfo } from "../types";

const [rootPath, setRootPath] = createSignal<string | null>(null);
const [projectInfo, setProjectInfo] = createSignal<ProjectInfo | null>(null);
const [fileTree, setFileTree] = createStore<FileNode[]>([]);
const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
const [isLoading, setIsLoading] = createSignal(false);

// Convert backend FileTreeNode to frontend FileNode
function convertTreeNode(node: FileTreeNode): FileNode {
  return {
    id: node.path,
    name: node.name,
    path: node.path,
    type: node.is_dir ? "directory" : "file",
    children: node.children?.map(convertTreeNode),
    isExpanded: false,
    isHidden: node.is_hidden,
  };
}

export const filesStore = {
  rootPath,
  projectInfo,
  fileTree,
  selectedPath,
  setSelectedPath,
  isLoading,

  // Open a project directory
  async openProject(path: string) {
    setIsLoading(true);
    try {
      const info = await ipc.openProject(path);
      const tree = await ipc.getFileTree(path, 2);

      batch(() => {
        setRootPath(path);
        setProjectInfo(info);
        setFileTree(tree.map(convertTreeNode));
      });

      return info;
    } catch (e) {
      console.error("Failed to open project:", e);
      throw e;
    } finally {
      setIsLoading(false);
    }
  },

  // Toggle directory expansion
  async toggleExpand(path: string) {
    async function toggleInTree(nodes: FileNode[]): Promise<FileNode[]> {
      const result: FileNode[] = [];
      for (const node of nodes) {
        if (node.path === path) {
          if (node.type === "directory") {
            const isExpanding = !node.isExpanded;
            let children = node.children;

            // Load children if expanding and no children yet
            if (isExpanding && (!children || children.length === 0)) {
              try {
                const childNodes = await ipc.expandDirectory(path);
                children = childNodes.map(convertTreeNode);
              } catch (e) {
                console.error("Failed to expand directory:", e);
                children = [];
              }
            }

            result.push({ ...node, isExpanded: isExpanding, children });
          } else {
            result.push(node);
          }
        } else if (node.children) {
          result.push({ ...node, children: await toggleInTree(node.children) });
        } else {
          result.push(node);
        }
      }
      return result;
    }

    const newTree = await toggleInTree([...fileTree]);
    setFileTree(newTree);
  },

  // Refresh the file tree
  async refresh() {
    const path = rootPath();
    if (!path) return;

    setIsLoading(true);
    try {
      const tree = await ipc.getFileTree(path, 2);
      setFileTree(tree.map(convertTreeNode));
    } catch (e) {
      console.error("Failed to refresh file tree:", e);
    } finally {
      setIsLoading(false);
    }
  },
};
