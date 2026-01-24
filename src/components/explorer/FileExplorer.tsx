import { createSignal, For, onCleanup, onMount, Show } from "solid-js";
import * as ipc from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";
import { editorStore, filesStore } from "../../stores";
import type { FileNode } from "../../types";

// Flatten file tree for keyboard navigation
function flattenTree(nodes: FileNode[], result: FileNode[] = []): FileNode[] {
  for (const node of nodes) {
    result.push(node);
    if (node.type === "directory" && node.isExpanded && node.children) {
      flattenTree(node.children, result);
    }
  }
  return result;
}

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

// Demo file tree for browser environment
const DEMO_FILE_TREE: FileNode[] = [
  {
    id: "src",
    name: "src",
    path: "/demo/src",
    type: "directory",
    isExpanded: true,
    children: [
      {
        id: "src/components",
        name: "components",
        path: "/demo/src/components",
        type: "directory",
        isExpanded: false,
        children: [
          {
            id: "src/components/App.tsx",
            name: "App.tsx",
            path: "/demo/src/components/App.tsx",
            type: "file",
          },
          {
            id: "src/components/Button.tsx",
            name: "Button.tsx",
            path: "/demo/src/components/Button.tsx",
            type: "file",
          },
          {
            id: "src/components/Header.tsx",
            name: "Header.tsx",
            path: "/demo/src/components/Header.tsx",
            type: "file",
          },
        ],
      },
      {
        id: "src/utils",
        name: "utils",
        path: "/demo/src/utils",
        type: "directory",
        isExpanded: false,
        children: [
          {
            id: "src/utils/helpers.ts",
            name: "helpers.ts",
            path: "/demo/src/utils/helpers.ts",
            type: "file",
          },
          {
            id: "src/utils/api.ts",
            name: "api.ts",
            path: "/demo/src/utils/api.ts",
            type: "file",
          },
        ],
      },
      {
        id: "src/main.tsx",
        name: "main.tsx",
        path: "/demo/src/main.tsx",
        type: "file",
      },
      {
        id: "src/index.css",
        name: "index.css",
        path: "/demo/src/index.css",
        type: "file",
      },
    ],
  },
  {
    id: "public",
    name: "public",
    path: "/demo/public",
    type: "directory",
    isExpanded: false,
    children: [
      {
        id: "public/index.html",
        name: "index.html",
        path: "/demo/public/index.html",
        type: "file",
      },
      {
        id: "public/favicon.ico",
        name: "favicon.ico",
        path: "/demo/public/favicon.ico",
        type: "file",
      },
    ],
  },
  {
    id: "package.json",
    name: "package.json",
    path: "/demo/package.json",
    type: "file",
  },
  {
    id: "tsconfig.json",
    name: "tsconfig.json",
    path: "/demo/tsconfig.json",
    type: "file",
  },
  { id: "README.md", name: "README.md", path: "/demo/README.md", type: "file" },
];

// Demo file contents
const DEMO_FILE_CONTENTS: Record<string, string> = {
  "/demo/src/main.tsx": `import { render } from "solid-js/web";
import App from "./components/App";
import "./index.css";

const root = document.getElementById("root");

if (root) {
  render(() => <App />, root);
}
`,
  "/demo/src/components/App.tsx": `import { createSignal } from "solid-js";
import { Button } from "./Button";
import { Header } from "./Header";

function App() {
  const [count, setCount] = createSignal(0);

  const increment = () => setCount(c => c + 1);
  const decrement = () => setCount(c => c - 1);

  return (
    <div class="min-h-screen bg-gray-100">
      <Header title="My App" />
      <main class="container mx-auto p-4">
        <h1 class="text-2xl font-bold mb-4">
          Counter: {count()}
        </h1>
        <div class="flex gap-2">
          <Button onClick={decrement}>-</Button>
          <Button onClick={increment}>+</Button>
        </div>
      </main>
    </div>
  );
}

export default App;
`,
  "/demo/src/components/Button.tsx": `import { JSX } from "solid-js";

interface ButtonProps {
  children: JSX.Element;
  onClick?: () => void;
  variant?: "primary" | "secondary";
}

export function Button(props: ButtonProps) {
  const variant = () => props.variant || "primary";

  return (
    <button
      class={\`px-4 py-2 rounded font-medium transition-colors \${
        variant() === "primary"
          ? "bg-blue-500 text-white hover:bg-blue-600"
          : "bg-gray-200 text-gray-800 hover:bg-gray-300"
      }\`}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
`,
  "/demo/src/components/Header.tsx": `interface HeaderProps {
  title: string;
}

export function Header(props: HeaderProps) {
  return (
    <header class="bg-white shadow">
      <div class="container mx-auto px-4 py-3">
        <h1 class="text-xl font-semibold text-gray-800">
          {props.title}
        </h1>
      </div>
    </header>
  );
}
`,
  "/demo/src/utils/helpers.ts": `/**
 * Utility helper functions
 */

export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): T {
  let timeoutId: ReturnType<typeof setTimeout>;

  return ((...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  }) as T;
}

export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number
): T {
  let inThrottle = false;

  return ((...args: unknown[]) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
`,
  "/demo/src/utils/api.ts": `const API_BASE = "https://api.example.com";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export async function fetchApi<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const response = await fetch(\`\${API_BASE}\${endpoint}\`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(\`API Error: \${response.status}\`);
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => fetchApi<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, { method: "POST", body: data }),
  put: <T>(endpoint: string, data: unknown) =>
    fetchApi<T>(endpoint, { method: "PUT", body: data }),
  delete: <T>(endpoint: string) =>
    fetchApi<T>(endpoint, { method: "DELETE" }),
};
`,
  "/demo/src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #3b82f6;
  --secondary: #6b7280;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
  padding: 0;
}

* {
  box-sizing: border-box;
}
`,
  "/demo/public/index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My App</title>
  <link rel="icon" href="/favicon.ico" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
`,
  "/demo/package.json": `{
  "name": "my-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "solid-js": "^1.9.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vite-plugin-solid": "^2.10.0"
  }
}
`,
  "/demo/tsconfig.json": `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "jsxImportSource": "solid-js",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
`,
  "/demo/README.md": `# My App

A simple SolidJS application.

## Getting Started

\`\`\`bash
npm install
npm run dev
\`\`\`

## Features

- Counter component
- Reusable Button component
- API utilities
- TypeScript support

## Project Structure

\`\`\`
src/
  components/   # UI components
  utils/        # Helper functions
  main.tsx      # Entry point
  index.css     # Global styles
\`\`\`
`,
};

function FileIcon(props: {
  name: string;
  type: "file" | "directory";
  isExpanded?: boolean | undefined;
}) {
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
            <path
              fill="#dcb67a"
              d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"
            />
          }
        >
          <path
            fill="#dcb67a"
            d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"
          />
        </Show>
      </svg>
    </Show>
  );
}

function FileTreeItem(props: {
  node: FileNode;
  depth: number;
  onToggle?: ((path: string) => void) | undefined;
  onSelect?: ((node: FileNode) => void) | undefined;
  selectedPath?: string | null | undefined;
  focusedPath?: string | null | undefined;
}) {
  const [isLoading, setIsLoading] = createSignal(false);

  const handleClick = async () => {
    if (props.node.type === "directory") {
      setIsLoading(true);
      try {
        props.onToggle?.(props.node.path);
      } finally {
        setIsLoading(false);
      }
    } else {
      props.onSelect?.(props.node);
    }
  };

  return (
    <>
      <div
        class="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-bg-hover transition-colors"
        classList={{
          "bg-bg-active": props.selectedPath === props.node.path,
          "ring-1 ring-accent/50": props.focusedPath === props.node.path,
          "opacity-50": props.node.isHidden,
        }}
        style={{ "padding-left": `${props.depth * 12 + 8}px` }}
        onClick={handleClick}
        data-path={props.node.path}
      >
        <Show when={props.node.type === "directory"}>
          <svg
            class="w-3 h-3 flex-shrink-0 transition-transform"
            classList={{ "rotate-90": props.node.isExpanded }}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </Show>
        <Show when={props.node.type === "file"}>
          <div class="w-3" />
        </Show>
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
          {(child) => (
            <FileTreeItem
              node={child}
              depth={props.depth + 1}
              onToggle={props.onToggle}
              onSelect={props.onSelect}
              selectedPath={props.selectedPath}
              focusedPath={props.focusedPath}
            />
          )}
        </For>
      </Show>
    </>
  );
}

export function FileExplorer() {
  const { fileTree, projectInfo, isLoading } = filesStore;
  const [demoTree, setDemoTree] = createSignal<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [focusedPath, setFocusedPath] = createSignal<string | null>(null);
  const [isDemoMode, setIsDemoMode] = createSignal(!isTauriEnvironment());
  const [isFocused, setIsFocused] = createSignal(false);
  let containerRef: HTMLDivElement | undefined;

  // Initialize demo tree in browser mode
  const loadDemoProject = () => {
    setDemoTree(JSON.parse(JSON.stringify(DEMO_FILE_TREE)));
    setIsDemoMode(true);
  };

  // Toggle folder expansion in demo mode
  const toggleDemoFolder = (path: string) => {
    setDemoTree((prev) => {
      const toggle = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === path && node.type === "directory") {
            return { ...node, isExpanded: !node.isExpanded };
          }
          if (node.children) {
            return { ...node, children: toggle(node.children) };
          }
          return node;
        });
      };
      return toggle(prev);
    });
  };

  // Open file in demo mode
  const openDemoFile = (node: FileNode) => {
    if (node.type !== "file") return;

    setSelectedPath(node.path);
    const content = DEMO_FILE_CONTENTS[node.path] || `// Content for ${node.name}`;
    editorStore.openFile(node.path, content);
  };

  // Open folder using Tauri dialog
  const handleOpenFolder = async () => {
    if (!isTauriEnvironment()) {
      loadDemoProject();
      return;
    }

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Folder",
      });

      if (selected && typeof selected === "string") {
        await filesStore.openProject(selected);
      }
    } catch (e) {
      console.error("Failed to open folder:", e);
      // Fallback to demo mode
      loadDemoProject();
    }
  };

  // Handle file selection in Tauri mode
  const handleTauriFileSelect = async (node: FileNode) => {
    if (node.type !== "file") return;

    filesStore.setSelectedPath(node.path);
    try {
      // Use buffer-backed file opening for proper backend integration
      await editorStore.openFileWithBuffer(node.path);
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  };

  // Create new file
  const [isCreatingFile, setIsCreatingFile] = createSignal(false);
  const [newFileName, setNewFileName] = createSignal("");

  const handleNewFile = async () => {
    if (!isTauriEnvironment()) {
      // Demo mode - just show input
      setIsCreatingFile(true);
      return;
    }

    setIsCreatingFile(true);
  };

  const confirmNewFile = async () => {
    const name = newFileName().trim();
    if (!name) {
      setIsCreatingFile(false);
      return;
    }

    const rootPath = filesStore.rootPath();
    if (!rootPath && !isDemoMode()) {
      setIsCreatingFile(false);
      return;
    }

    if (isTauriEnvironment() && rootPath) {
      try {
        const filePath = `${rootPath}/${name}`;
        await ipc.writeFile(filePath, "");
        await filesStore.refresh();
        await editorStore.openFileWithBuffer(filePath);
      } catch (e) {
        console.error("Failed to create file:", e);
      }
    } else {
      // Demo mode - create in memory
      editorStore.openFile(`/demo/${name}`, "");
    }

    setNewFileName("");
    setIsCreatingFile(false);
  };

  // Determine which tree to show
  const currentTree = () => (isDemoMode() ? demoTree() : fileTree);
  const hasProject = () => currentTree().length > 0;

  // Keyboard navigation handlers
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!hasProject() || !isFocused()) return;

    const flatNodes = flattenTree(currentTree());
    if (flatNodes.length === 0) return;

    const currentIndex = flatNodes.findIndex((n) => n.path === focusedPath());
    let newIndex = currentIndex;
    let handled = false;

    switch (e.key) {
      case "j":
      case "ArrowDown":
        newIndex = Math.min(currentIndex + 1, flatNodes.length - 1);
        if (currentIndex === -1) newIndex = 0;
        handled = true;
        break;
      case "k":
      case "ArrowUp":
        newIndex = Math.max(currentIndex - 1, 0);
        if (currentIndex === -1) newIndex = flatNodes.length - 1;
        handled = true;
        break;
      case "h":
      case "ArrowLeft": {
        // Collapse directory or go to parent
        const current = flatNodes[currentIndex];
        if (current?.type === "directory" && current.isExpanded) {
          if (isDemoMode()) {
            toggleDemoFolder(current.path);
          } else {
            filesStore.toggleExpand(current.path);
          }
        } else if (current) {
          // Find parent directory
          const parentPath = current.path.split("/").slice(0, -1).join("/");
          const parentIndex = flatNodes.findIndex((n) => n.path === parentPath);
          if (parentIndex >= 0) newIndex = parentIndex;
        }
        handled = true;
        break;
      }
      case "l":
      case "ArrowRight": {
        // Expand directory or enter
        const current = flatNodes[currentIndex];
        if (current?.type === "directory") {
          if (!current.isExpanded) {
            if (isDemoMode()) {
              toggleDemoFolder(current.path);
            } else {
              filesStore.toggleExpand(current.path);
            }
          } else if (current.children && current.children.length > 0) {
            // Move to first child
            newIndex = currentIndex + 1;
          }
        }
        handled = true;
        break;
      }
      case "Enter":
      case " ": {
        const current = flatNodes[currentIndex];
        if (current) {
          if (current.type === "directory") {
            if (isDemoMode()) {
              toggleDemoFolder(current.path);
            } else {
              filesStore.toggleExpand(current.path);
            }
          } else {
            if (isDemoMode()) {
              openDemoFile(current);
            } else {
              handleTauriFileSelect(current);
            }
          }
        }
        handled = true;
        break;
      }
      case "g":
        // Go to top
        if (e.shiftKey) {
          newIndex = flatNodes.length - 1; // G = go to bottom
        } else {
          newIndex = 0; // g = go to top
        }
        handled = true;
        break;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      if (newIndex !== currentIndex && flatNodes[newIndex]) {
        setFocusedPath(flatNodes[newIndex]?.path ?? null);
        // Scroll into view
        const element = containerRef?.querySelector(`[data-path="${flatNodes[newIndex]?.path}"]`);
        element?.scrollIntoView({ block: "nearest" });
      }
    }
  };

  onMount(() => {
    // Add keyboard listener
    const handler = (e: KeyboardEvent) => handleKeyDown(e);
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });

  return (
    <div
      ref={containerRef}
      class="h-full flex flex-col outline-none"
      tabIndex={0}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      {/* Toolbar */}
      <div class="flex items-center gap-1 px-2 py-1 border-b border-border">
        <button
          class="p-1 hover:bg-bg-hover rounded transition-colors"
          onClick={handleOpenFolder}
          title="Open Folder"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
          </svg>
        </button>
        <button
          class="p-1 hover:bg-bg-hover rounded transition-colors"
          onClick={() => (isDemoMode() ? loadDemoProject() : filesStore.refresh())}
          title="Refresh"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z" />
          </svg>
        </button>
        <button
          class="p-1 hover:bg-bg-hover rounded transition-colors"
          title="New File"
          onClick={handleNewFile}
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v3h-2v-3H8v-2h3v-3h2v3h3v2zm-3-7V3.5L18.5 9H13z" />
          </svg>
        </button>
        <button class="p-1 hover:bg-bg-hover rounded transition-colors" title="New Folder">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-1 8h-3v3h-2v-3H8v-2h3v-3h2v3h3v2z" />
          </svg>
        </button>
      </div>

      {/* New File Input */}
      <Show when={isCreatingFile()}>
        <div class="px-2 py-1 border-b border-border">
          <input
            type="text"
            class="w-full px-2 py-1 bg-bg-tertiary text-text-primary text-sm rounded border border-accent outline-none"
            placeholder="Enter file name..."
            value={newFileName()}
            onInput={(e) => setNewFileName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmNewFile();
              if (e.key === "Escape") {
                setIsCreatingFile(false);
                setNewFileName("");
              }
            }}
            onBlur={() => {
              if (!newFileName().trim()) {
                setIsCreatingFile(false);
              }
            }}
            autofocus
          />
        </div>
      </Show>

      {/* File Tree */}
      <div class="flex-1 overflow-auto py-1">
        <Show when={isLoading()}>
          <div class="flex items-center justify-center py-4">
            <div class="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        </Show>
        <Show when={!isLoading()}>
          <Show
            when={hasProject()}
            fallback={
              <div class="px-4 py-8 text-center">
                <div class="text-text-secondary text-sm mb-4">No folder opened</div>
                <button
                  class="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90 transition-colors text-sm"
                  onClick={handleOpenFolder}
                >
                  Open Folder
                </button>
                <Show when={!isTauriEnvironment()}>
                  <p class="text-text-tertiary text-xs mt-3">Or click to load demo project</p>
                </Show>
              </div>
            }
          >
            <Show when={isDemoMode()}>
              <div class="px-2 py-1 text-xs text-text-secondary uppercase tracking-wide font-medium flex items-center gap-1">
                <span class="text-accent">Demo</span>
                <span>my-app</span>
              </div>
            </Show>
            <Show when={!isDemoMode() && projectInfo()}>
              <div class="px-2 py-1 text-xs text-text-secondary uppercase tracking-wide font-medium">
                {projectInfo()?.name}
                <Show when={projectInfo()?.has_git}>
                  <span class="ml-1 text-accent">(git)</span>
                </Show>
              </div>
            </Show>
            <For each={currentTree()}>
              {(node) => (
                <FileTreeItem
                  node={node}
                  depth={0}
                  onToggle={
                    isDemoMode() ? toggleDemoFolder : (path) => filesStore.toggleExpand(path)
                  }
                  onSelect={isDemoMode() ? openDemoFile : handleTauriFileSelect}
                  selectedPath={isDemoMode() ? selectedPath() : filesStore.selectedPath()}
                  focusedPath={focusedPath()}
                />
              )}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
}
