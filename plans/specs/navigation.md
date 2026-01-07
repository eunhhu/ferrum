# Navigation Specification

## Summary

파일 탐색과 코드베이스 구조 파악을 직관적으로 만드는 핵심 기능들.

## Features

1. **Tree Viewer** - 깊이별 컬러 컨테이닝 + 스티키 헤더
2. **Tree Fold** - 피그마식 레이어 네비게이션 + n-depth fold
3. **Navigation Trail** - 브레드크럼 + 히스토리 백트래킹
4. **Dependency Highlight** - 의존 파일 시각적 연결
5. **Related Files** - 연관 파일 그룹핑

---

## 1. Tree Viewer

### Motivation

기존 파일 탐색기는 깊은 디렉토리 구조에서 현재 위치 파악이 어려움.
Monaco 에디터의 스티키 스코프 헤드라인 개념을 파일 트리에 적용.

### User Stories

- As a developer, 깊은 폴더 구조에서도 현재 어느 디렉토리에 있는지 한눈에 파악하고 싶다.
- As a developer, 상위 폴더 컨텍스트를 잃지 않으면서 하위 파일들을 탐색하고 싶다.

### Detailed Design

#### Visual Concept

```
┌─────────────────────────────────────┐
│ ▼ src                          [S] │ ← 스티키 헤더 (depth 0)
├─────────────────────────────────────┤
│ │ ▼ components                 [S] │ ← 스티키 헤더 (depth 1, 스크롤 시)
│ ├─────────────────────────────────┐│
│ │ │ ▼ editor                    ││ ← depth 2 컨테이너 (색상 A)
│ │ ├───────────────────────────┐ ││
│ │ │ │  Editor.tsx             │ ││
│ │ │ │  Cursor.tsx             │ ││
│ │ │ │  Selection.tsx          │ ││
│ │ └───────────────────────────┘ ││
│ │ │ ▼ explorer                  ││ ← depth 2 컨테이너 (색상 B)
│ │ ├───────────────────────────┐ ││
│ │ │ │  FileExplorer.tsx       │ ││
│ │ │ │  TreeNode.tsx           │ ││
│ │ └───────────────────────────┘ ││
│ └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

#### Depth Color Scheme

```typescript
// src/constants/treeColors.ts

export const DEPTH_COLORS = {
  // 배경색 (투명도 적용)
  bg: [
    "rgba(99, 102, 241, 0.08)",   // depth 0: indigo
    "rgba(139, 92, 246, 0.08)",   // depth 1: violet
    "rgba(236, 72, 153, 0.08)",   // depth 2: pink
    "rgba(249, 115, 22, 0.08)",   // depth 3: orange
    "rgba(34, 197, 94, 0.08)",    // depth 4: green
    "rgba(6, 182, 212, 0.08)",    // depth 5: cyan
  ],
  // 보더/라인 색상
  border: [
    "rgba(99, 102, 241, 0.3)",
    "rgba(139, 92, 246, 0.3)",
    "rgba(236, 72, 153, 0.3)",
    "rgba(249, 115, 22, 0.3)",
    "rgba(34, 197, 94, 0.3)",
    "rgba(6, 182, 212, 0.3)",
  ],
} as const;

export function getDepthColor(depth: number, type: "bg" | "border"): string {
  const colors = DEPTH_COLORS[type];
  return colors[depth % colors.length];
}
```

#### Data Types

```rust
// src-tauri/src/services/file_tree.rs

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTreeNode {
    pub id: String,                    // Unique ID (path hash)
    pub name: String,                  // File/folder name
    pub path: PathBuf,                 // Absolute path
    pub node_type: FileNodeType,
    pub depth: u32,                    // Depth in tree (for coloring)
    pub children: Option<Vec<FileTreeNode>>,
    pub is_expanded: bool,
    pub metadata: FileMetadata,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum FileNodeType {
    File,
    Directory,
    Symlink,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetadata {
    pub size: u64,
    pub modified: Option<u64>,         // Unix timestamp
    pub is_hidden: bool,
    pub extension: Option<String>,
    pub language: Option<String>,       // Detected language
}

/// Sticky header information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StickyHeader {
    pub node_id: String,
    pub name: String,
    pub path: PathBuf,
    pub depth: u32,
}

/// Tree viewport state (for virtualization)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeViewport {
    pub visible_nodes: Vec<String>,     // Node IDs currently visible
    pub sticky_headers: Vec<StickyHeader>,
    pub scroll_offset: f64,
    pub viewport_height: f64,
}
```

```typescript
// src/types/fileTree.ts

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  nodeType: "File" | "Directory" | "Symlink";
  depth: number;
  children?: FileTreeNode[];
  isExpanded: boolean;
  metadata: FileMetadata;
}

export interface FileMetadata {
  size: number;
  modified?: number;
  isHidden: boolean;
  extension?: string;
  language?: string;
}

export interface StickyHeader {
  nodeId: string;
  name: string;
  path: string;
  depth: number;
}

export interface TreeViewport {
  visibleNodes: string[];
  stickyHeaders: StickyHeader[];
  scrollOffset: number;
  viewportHeight: number;
}
```

#### IPC Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `tree_get_root` | `path: string` | `FileTreeNode` | 루트 디렉토리 로드 |
| `tree_expand` | `nodeId: string` | `FileTreeNode[]` | 디렉토리 확장 (자식 로드) |
| `tree_collapse` | `nodeId: string` | `void` | 디렉토리 접기 |
| `tree_refresh` | `nodeId?: string` | `FileTreeNode` | 새로고침 (특정 노드 또는 전체) |
| `tree_get_sticky_headers` | `scrollOffset: number, viewportHeight: number, expandedNodes: string[]` | `StickyHeader[]` | 스티키 헤더 계산 |

```rust
// src-tauri/src/ipc/commands.rs (추가)

#[tauri::command]
pub async fn tree_get_root(
    state: State<'_, AppState>,
    path: String,
) -> Result<FileTreeNode, String> {
    let path = PathBuf::from(path);
    state.file_tree.get_root(&path).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tree_expand(
    state: State<'_, AppState>,
    node_id: String,
) -> Result<Vec<FileTreeNode>, String> {
    state.file_tree.expand(&node_id).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tree_collapse(
    state: State<'_, AppState>,
    node_id: String,
) -> Result<(), String> {
    state.file_tree.collapse(&node_id).await;
    Ok(())
}

#[tauri::command]
pub async fn tree_get_sticky_headers(
    state: State<'_, AppState>,
    scroll_offset: f64,
    viewport_height: f64,
    expanded_nodes: Vec<String>,
) -> Result<Vec<StickyHeader>, String> {
    Ok(state.file_tree.compute_sticky_headers(
        scroll_offset,
        viewport_height,
        &expanded_nodes,
    ))
}
```

```typescript
// src/ipc/commands.ts (추가)

export const tree = {
  getRoot: (path: string): Promise<FileTreeNode> =>
    invoke("tree_get_root", { path }),

  expand: (nodeId: string): Promise<FileTreeNode[]> =>
    invoke("tree_expand", { nodeId }),

  collapse: (nodeId: string): Promise<void> =>
    invoke("tree_collapse", { nodeId }),

  getStickyHeaders: (
    scrollOffset: number,
    viewportHeight: number,
    expandedNodes: string[]
  ): Promise<StickyHeader[]> =>
    invoke("tree_get_sticky_headers", { scrollOffset, viewportHeight, expandedNodes }),
};
```

#### Sticky Header Algorithm

```rust
// src-tauri/src/services/file_tree.rs

impl FileTreeService {
    /// Compute which headers should be sticky based on scroll position
    pub fn compute_sticky_headers(
        &self,
        scroll_offset: f64,
        viewport_height: f64,
        expanded_nodes: &[String],
    ) -> Vec<StickyHeader> {
        let tree = self.tree.read();
        let mut sticky_headers = Vec::new();
        let mut current_ancestors: Vec<StickyHeader> = Vec::new();
        let mut accumulated_height = 0.0;

        const ROW_HEIGHT: f64 = 24.0;
        const HEADER_HEIGHT: f64 = 28.0;

        self.traverse_visible_nodes(&tree, expanded_nodes, |node, depth| {
            let node_top = accumulated_height;
            let node_bottom = node_top + ROW_HEIGHT;

            // Update ancestor stack
            while current_ancestors.len() > depth as usize {
                current_ancestors.pop();
            }

            if node.node_type == FileNodeType::Directory && node.is_expanded {
                current_ancestors.push(StickyHeader {
                    node_id: node.id.clone(),
                    name: node.name.clone(),
                    path: node.path.clone(),
                    depth,
                });
            }

            // Check if this directory header should be sticky
            // A header becomes sticky when:
            // 1. It's scrolled past the top of viewport
            // 2. Its content is still partially visible
            if node.node_type == FileNodeType::Directory {
                let content_end = self.get_subtree_end(&node, expanded_nodes);
                
                if node_top < scroll_offset && content_end > scroll_offset {
                    // This header should be sticky
                    if !sticky_headers.iter().any(|h| h.node_id == node.id) {
                        sticky_headers.push(StickyHeader {
                            node_id: node.id.clone(),
                            name: node.name.clone(),
                            path: node.path.clone(),
                            depth,
                        });
                    }
                }
            }

            accumulated_height += ROW_HEIGHT;
        });

        // Sort by depth to ensure proper stacking order
        sticky_headers.sort_by_key(|h| h.depth);
        sticky_headers
    }

    fn traverse_visible_nodes<F>(
        &self,
        node: &FileTreeNode,
        expanded_nodes: &[String],
        callback: F,
    ) where
        F: FnMut(&FileTreeNode, u32),
    {
        self.traverse_recursive(node, 0, expanded_nodes, &mut callback);
    }

    fn traverse_recursive<F>(
        &self,
        node: &FileTreeNode,
        depth: u32,
        expanded_nodes: &[String],
        callback: &mut F,
    ) where
        F: FnMut(&FileTreeNode, u32),
    {
        callback(node, depth);

        if node.node_type == FileNodeType::Directory 
            && expanded_nodes.contains(&node.id) 
        {
            if let Some(ref children) = node.children {
                for child in children {
                    self.traverse_recursive(child, depth + 1, expanded_nodes, callback);
                }
            }
        }
    }
}
```

#### Component Implementation

```typescript
// src/components/explorer/TreeContainer.tsx

import { For, Show, createMemo } from "solid-js";
import { getDepthColor } from "../../constants/treeColors";
import type { FileTreeNode } from "../../types/fileTree";

interface TreeContainerProps {
  node: FileTreeNode;
  onSelect: (node: FileTreeNode) => void;
  onToggle: (node: FileTreeNode) => void;
}

export function TreeContainer(props: TreeContainerProps) {
  const bgColor = createMemo(() => getDepthColor(props.node.depth, "bg"));
  const borderColor = createMemo(() => getDepthColor(props.node.depth, "border"));

  return (
    <div
      class="tree-container"
      style={{
        "background-color": bgColor(),
        "border-left": `2px solid ${borderColor()}`,
        "margin-left": `${props.node.depth * 8}px`,
        "padding-left": "4px",
      }}
    >
      <TreeNodeHeader
        node={props.node}
        onSelect={props.onSelect}
        onToggle={props.onToggle}
      />
      
      <Show when={props.node.isExpanded && props.node.children}>
        <div class="tree-children">
          <For each={props.node.children}>
            {(child) => (
              <Show
                when={child.nodeType === "Directory"}
                fallback={
                  <TreeFileNode
                    node={child}
                    onSelect={props.onSelect}
                  />
                }
              >
                <TreeContainer
                  node={child}
                  onSelect={props.onSelect}
                  onToggle={props.onToggle}
                />
              </Show>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
```

```typescript
// src/components/explorer/StickyHeaders.tsx

import { For } from "solid-js";
import type { StickyHeader } from "../../types/fileTree";
import { getDepthColor } from "../../constants/treeColors";

interface StickyHeadersProps {
  headers: StickyHeader[];
  onHeaderClick: (header: StickyHeader) => void;
}

export function StickyHeaders(props: StickyHeadersProps) {
  return (
    <div class="sticky-headers-container absolute top-0 left-0 right-0 z-10">
      <For each={props.headers}>
        {(header, index) => (
          <div
            class="sticky-header flex items-center px-2 py-1 cursor-pointer hover:brightness-110"
            style={{
              "background-color": getDepthColor(header.depth, "bg"),
              "border-bottom": `1px solid ${getDepthColor(header.depth, "border")}`,
              "padding-left": `${header.depth * 8 + 4}px`,
              // Stack headers: each subsequent header appears below
              "top": `${index() * 28}px`,
            }}
            onClick={() => props.onHeaderClick(header)}
          >
            <span class="icon mr-1">▼</span>
            <span class="name font-medium">{header.name}</span>
          </div>
        )}
      </For>
    </div>
  );
}
```

---

## 2. Tree Fold

### Motivation

피그마의 레이어 패널처럼, 키보드로 빠르게 트리를 탐색하고 특정 깊이까지만 펼치거나 접을 수 있음.

### User Stories

- As a developer, 키보드만으로 트리 구조를 빠르게 탐색하고 싶다.
- As a developer, 현재 폴더의 직속 자식만 보고 싶을 때 깊은 하위 구조를 한번에 접고 싶다.
- As a developer, 특정 깊이 n까지만 펼쳐서 전체 구조를 파악하고 싶다.

### Detailed Design

#### Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `↑` / `↓` | Navigate | 이전/다음 노드로 이동 |
| `←` | Collapse / Parent | 접기 또는 부모로 이동 |
| `→` | Expand / First Child | 펼치기 또는 첫 자식으로 이동 |
| `Enter` | Open / Toggle | 파일 열기 또는 폴더 토글 |
| `Cmd/Ctrl + ←` | Collapse All | 선택된 노드 하위 전체 접기 |
| `Cmd/Ctrl + →` | Expand All | 선택된 노드 하위 전체 펼치기 |
| `Cmd/Ctrl + Shift + ←` | Fold to Depth N | 현재 깊이까지만 펼치고 나머지 접기 |
| `Alt + ←` | Collapse Siblings | 같은 레벨 형제들 모두 접기 |
| `Alt + →` | Expand Siblings | 같은 레벨 형제들 모두 펼치기 |
| `Cmd/Ctrl + 1-9` | Fold to Level N | 전체 트리를 N 레벨까지만 펼치기 |

#### Data Types

```rust
// src-tauri/src/services/file_tree.rs (추가)

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FoldRequest {
    pub node_id: Option<String>,      // None = root
    pub fold_type: FoldType,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum FoldType {
    CollapseAll,                       // 전체 접기
    ExpandAll,                         // 전체 펼치기
    FoldToDepth(u32),                  // 특정 깊이까지만
    CollapseSiblings,                  // 형제 접기
    ExpandSiblings,                    // 형제 펼치기
    FoldToCurrentDepth,                // 현재 깊이까지만
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNavigation {
    pub focused_node_id: Option<String>,
    pub selected_node_ids: Vec<String>,  // Multi-select 지원
}
```

```typescript
// src/types/fileTree.ts (추가)

export type FoldType =
  | { type: "CollapseAll" }
  | { type: "ExpandAll" }
  | { type: "FoldToDepth"; depth: number }
  | { type: "CollapseSiblings" }
  | { type: "ExpandSiblings" }
  | { type: "FoldToCurrentDepth" };

export interface FoldRequest {
  nodeId?: string;
  foldType: FoldType;
}

export interface TreeNavigation {
  focusedNodeId?: string;
  selectedNodeIds: string[];
}
```

#### IPC Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `tree_fold` | `FoldRequest` | `string[]` | 폴드 수행, 변경된 노드 ID 반환 |
| `tree_navigate` | `nodeId: string, direction: Direction` | `string?` | 키보드 네비게이션, 다음 노드 ID 반환 |
| `tree_get_parent` | `nodeId: string` | `string?` | 부모 노드 ID |
| `tree_get_siblings` | `nodeId: string` | `string[]` | 형제 노드 IDs |

```rust
// src-tauri/src/ipc/commands.rs (추가)

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum NavigationDirection {
    Up,
    Down,
    Left,   // Parent or collapse
    Right,  // First child or expand
}

#[tauri::command]
pub async fn tree_fold(
    state: State<'_, AppState>,
    request: FoldRequest,
) -> Result<Vec<String>, String> {
    state.file_tree.fold(&request).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn tree_navigate(
    state: State<'_, AppState>,
    node_id: String,
    direction: NavigationDirection,
    expanded_nodes: Vec<String>,
) -> Result<Option<String>, String> {
    Ok(state.file_tree.navigate(&node_id, direction, &expanded_nodes))
}

#[tauri::command]
pub async fn tree_get_parent(
    state: State<'_, AppState>,
    node_id: String,
) -> Result<Option<String>, String> {
    Ok(state.file_tree.get_parent(&node_id))
}

#[tauri::command]
pub async fn tree_get_siblings(
    state: State<'_, AppState>,
    node_id: String,
) -> Result<Vec<String>, String> {
    Ok(state.file_tree.get_siblings(&node_id))
}
```

#### Fold Algorithm

```rust
// src-tauri/src/services/file_tree.rs

impl FileTreeService {
    pub async fn fold(&self, request: &FoldRequest) -> Result<Vec<String>, FileTreeError> {
        let mut tree = self.tree.write();
        let mut changed_nodes = Vec::new();

        let target_node = match &request.node_id {
            Some(id) => self.find_node_mut(&mut tree, id)?,
            None => &mut tree,
        };

        match request.fold_type {
            FoldType::CollapseAll => {
                self.collapse_recursive(target_node, &mut changed_nodes);
            }
            FoldType::ExpandAll => {
                self.expand_recursive(target_node, &mut changed_nodes).await?;
            }
            FoldType::FoldToDepth(max_depth) => {
                self.fold_to_depth(target_node, 0, max_depth, &mut changed_nodes).await?;
            }
            FoldType::CollapseSiblings => {
                if let Some(parent) = self.get_parent_mut(&mut tree, &request.node_id.clone().unwrap()) {
                    if let Some(ref mut children) = parent.children {
                        for child in children.iter_mut() {
                            if child.id != request.node_id.clone().unwrap() {
                                self.collapse_recursive(child, &mut changed_nodes);
                            }
                        }
                    }
                }
            }
            FoldType::ExpandSiblings => {
                if let Some(parent) = self.get_parent_mut(&mut tree, &request.node_id.clone().unwrap()) {
                    if let Some(ref mut children) = parent.children {
                        for child in children.iter_mut() {
                            if child.node_type == FileNodeType::Directory && !child.is_expanded {
                                child.is_expanded = true;
                                self.load_children(child).await?;
                                changed_nodes.push(child.id.clone());
                            }
                        }
                    }
                }
            }
            FoldType::FoldToCurrentDepth => {
                let current_depth = target_node.depth;
                self.fold_to_depth(&mut tree, 0, current_depth, &mut changed_nodes).await?;
            }
        }

        Ok(changed_nodes)
    }

    fn collapse_recursive(&self, node: &mut FileTreeNode, changed: &mut Vec<String>) {
        if node.is_expanded {
            node.is_expanded = false;
            changed.push(node.id.clone());
        }
        
        if let Some(ref mut children) = node.children {
            for child in children.iter_mut() {
                if child.node_type == FileNodeType::Directory {
                    self.collapse_recursive(child, changed);
                }
            }
        }
    }

    async fn expand_recursive(
        &self,
        node: &mut FileTreeNode,
        changed: &mut Vec<String>,
    ) -> Result<(), FileTreeError> {
        if node.node_type == FileNodeType::Directory {
            if !node.is_expanded {
                node.is_expanded = true;
                self.load_children(node).await?;
                changed.push(node.id.clone());
            }
            
            if let Some(ref mut children) = node.children {
                for child in children.iter_mut() {
                    Box::pin(self.expand_recursive(child, changed)).await?;
                }
            }
        }
        Ok(())
    }

    async fn fold_to_depth(
        &self,
        node: &mut FileTreeNode,
        current_depth: u32,
        max_depth: u32,
        changed: &mut Vec<String>,
    ) -> Result<(), FileTreeError> {
        if node.node_type != FileNodeType::Directory {
            return Ok(());
        }

        if current_depth < max_depth {
            // Should be expanded
            if !node.is_expanded {
                node.is_expanded = true;
                self.load_children(node).await?;
                changed.push(node.id.clone());
            }
            
            if let Some(ref mut children) = node.children {
                for child in children.iter_mut() {
                    Box::pin(self.fold_to_depth(child, current_depth + 1, max_depth, changed)).await?;
                }
            }
        } else {
            // Should be collapsed
            self.collapse_recursive(node, changed);
        }

        Ok(())
    }

    /// Navigate to adjacent node based on direction
    pub fn navigate(
        &self,
        node_id: &str,
        direction: NavigationDirection,
        expanded_nodes: &[String],
    ) -> Option<String> {
        let tree = self.tree.read();
        let flat_list = self.flatten_visible_nodes(&tree, expanded_nodes);
        
        let current_idx = flat_list.iter().position(|id| id == node_id)?;

        match direction {
            NavigationDirection::Up => {
                if current_idx > 0 {
                    Some(flat_list[current_idx - 1].clone())
                } else {
                    None
                }
            }
            NavigationDirection::Down => {
                if current_idx < flat_list.len() - 1 {
                    Some(flat_list[current_idx + 1].clone())
                } else {
                    None
                }
            }
            NavigationDirection::Left => {
                let node = self.find_node(&tree, node_id)?;
                if node.node_type == FileNodeType::Directory && node.is_expanded {
                    // Collapse this node
                    Some(node_id.to_string()) // Signal to collapse
                } else {
                    // Go to parent
                    self.get_parent_id(node_id)
                }
            }
            NavigationDirection::Right => {
                let node = self.find_node(&tree, node_id)?;
                if node.node_type == FileNodeType::Directory {
                    if !node.is_expanded {
                        // Expand this node
                        Some(node_id.to_string()) // Signal to expand
                    } else if let Some(ref children) = node.children {
                        // Go to first child
                        children.first().map(|c| c.id.clone())
                    } else {
                        None
                    }
                } else {
                    None
                }
            }
        }
    }

    fn flatten_visible_nodes(&self, node: &FileTreeNode, expanded: &[String]) -> Vec<String> {
        let mut result = vec![node.id.clone()];
        
        if node.node_type == FileNodeType::Directory 
            && expanded.contains(&node.id) 
            && node.children.is_some() 
        {
            for child in node.children.as_ref().unwrap() {
                result.extend(self.flatten_visible_nodes(child, expanded));
            }
        }
        
        result
    }
}
```

#### Keyboard Handler

```typescript
// src/components/explorer/useTreeKeyboard.ts

import { createSignal, onCleanup, onMount } from "solid-js";
import { tree } from "../../ipc/commands";
import type { FoldType, TreeNavigation } from "../../types/fileTree";

export function useTreeKeyboard(
  getExpandedNodes: () => string[],
  setExpandedNodes: (nodes: string[]) => void,
  getNavigation: () => TreeNavigation,
  setNavigation: (nav: TreeNavigation) => void,
  onOpenFile: (nodeId: string) => void,
) {
  const handleKeyDown = async (e: KeyboardEvent) => {
    const nav = getNavigation();
    if (!nav.focusedNodeId) return;

    const isMod = e.metaKey || e.ctrlKey;
    const isShift = e.shiftKey;
    const isAlt = e.altKey;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        const prevId = await tree.navigate(
          nav.focusedNodeId,
          "Up",
          getExpandedNodes()
        );
        if (prevId) {
          setNavigation({ ...nav, focusedNodeId: prevId });
        }
        break;

      case "ArrowDown":
        e.preventDefault();
        const nextId = await tree.navigate(
          nav.focusedNodeId,
          "Down",
          getExpandedNodes()
        );
        if (nextId) {
          setNavigation({ ...nav, focusedNodeId: nextId });
        }
        break;

      case "ArrowLeft":
        e.preventDefault();
        if (isMod && isShift) {
          // Fold to current depth
          await tree.fold({
            nodeId: nav.focusedNodeId,
            foldType: { type: "FoldToCurrentDepth" },
          });
        } else if (isMod) {
          // Collapse all under current
          const changed = await tree.fold({
            nodeId: nav.focusedNodeId,
            foldType: { type: "CollapseAll" },
          });
          setExpandedNodes(
            getExpandedNodes().filter((id) => !changed.includes(id))
          );
        } else if (isAlt) {
          // Collapse siblings
          await tree.fold({
            nodeId: nav.focusedNodeId,
            foldType: { type: "CollapseSiblings" },
          });
        } else {
          // Navigate left (collapse or parent)
          const result = await tree.navigate(
            nav.focusedNodeId,
            "Left",
            getExpandedNodes()
          );
          if (result === nav.focusedNodeId) {
            // Collapse current
            setExpandedNodes(
              getExpandedNodes().filter((id) => id !== nav.focusedNodeId)
            );
          } else if (result) {
            // Go to parent
            setNavigation({ ...nav, focusedNodeId: result });
          }
        }
        break;

      case "ArrowRight":
        e.preventDefault();
        if (isMod) {
          // Expand all under current
          const changed = await tree.fold({
            nodeId: nav.focusedNodeId,
            foldType: { type: "ExpandAll" },
          });
          setExpandedNodes([...getExpandedNodes(), ...changed]);
        } else if (isAlt) {
          // Expand siblings
          await tree.fold({
            nodeId: nav.focusedNodeId,
            foldType: { type: "ExpandSiblings" },
          });
        } else {
          // Navigate right (expand or first child)
          const expanded = getExpandedNodes();
          if (!expanded.includes(nav.focusedNodeId)) {
            // Try to expand
            setExpandedNodes([...expanded, nav.focusedNodeId]);
          } else {
            // Go to first child
            const result = await tree.navigate(
              nav.focusedNodeId,
              "Right",
              expanded
            );
            if (result && result !== nav.focusedNodeId) {
              setNavigation({ ...nav, focusedNodeId: result });
            }
          }
        }
        break;

      case "Enter":
        e.preventDefault();
        // Open file or toggle folder
        onOpenFile(nav.focusedNodeId);
        break;

      default:
        // Cmd/Ctrl + 1-9: Fold to level N
        if (isMod && /^[1-9]$/.test(e.key)) {
          e.preventDefault();
          const level = parseInt(e.key, 10);
          await tree.fold({
            foldType: { type: "FoldToDepth", depth: level },
          });
        }
        break;
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });
}
```

---

## 3. Navigation Trail

### Motivation

코드 탐색 중 "어떻게 여기까지 왔는지" 맥락을 유지하고, 쉽게 이전 위치로 돌아갈 수 있어야 함.

### User Stories

- As a developer, 정의로 점프한 후 원래 위치로 쉽게 돌아가고 싶다.
- As a developer, 탐색 경로를 시각적으로 보고 중간 지점으로 바로 이동하고 싶다.
- As a developer, 현재 파일의 심볼 계층 구조(브레드크럼)를 보고 싶다.

### Detailed Design

#### Visual Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│ Breadcrumb (현재 위치)                                               │
│ src / components / editor / Editor.tsx > EditorView > handleClick   │
├─────────────────────────────────────────────────────────────────────┤
│ Navigation History (탐색 경로)                                       │
│ ← App.tsx:15 → EditorArea.tsx:42 → Editor.tsx:128 → [현재]         │
└─────────────────────────────────────────────────────────────────────┘
```

#### Data Types

```rust
// src-tauri/src/services/navigation.rs

use serde::{Deserialize, Serialize};

/// A single navigation entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NavigationEntry {
    pub id: String,                    // Unique ID
    pub file_path: PathBuf,
    pub position: Position,
    pub symbol_path: Vec<String>,      // e.g., ["EditorView", "handleClick"]
    pub timestamp: u64,
    pub label: String,                 // Display label (e.g., "Editor.tsx:128")
}

/// Navigation history state
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NavigationHistory {
    pub entries: Vec<NavigationEntry>,
    pub current_index: usize,          // Current position in history
    pub max_entries: usize,            // Max history size (default 100)
}

/// Breadcrumb segment
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BreadcrumbSegment {
    pub label: String,
    pub segment_type: BreadcrumbType,
    pub range: Option<Range>,          // Clickable range in file
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum BreadcrumbType {
    Directory,
    File,
    Symbol,
}

/// Full breadcrumb path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Breadcrumb {
    pub file_path: PathBuf,
    pub segments: Vec<BreadcrumbSegment>,
}
```

```typescript
// src/types/navigation.ts

export interface NavigationEntry {
  id: string;
  filePath: string;
  position: Position;
  symbolPath: string[];
  timestamp: number;
  label: string;
}

export interface NavigationHistory {
  entries: NavigationEntry[];
  currentIndex: number;
}

export interface BreadcrumbSegment {
  label: string;
  segmentType: "Directory" | "File" | "Symbol";
  range?: Range;
}

export interface Breadcrumb {
  filePath: string;
  segments: BreadcrumbSegment[];
}
```

#### IPC Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `nav_push` | `file_path, position` | `NavigationEntry` | 현재 위치를 히스토리에 추가 |
| `nav_back` | - | `NavigationEntry?` | 이전 위치로 |
| `nav_forward` | - | `NavigationEntry?` | 다음 위치로 |
| `nav_go_to` | `index: number` | `NavigationEntry?` | 특정 히스토리 인덱스로 |
| `nav_get_history` | - | `NavigationHistory` | 전체 히스토리 조회 |
| `nav_clear` | - | `void` | 히스토리 초기화 |
| `breadcrumb_get` | `buffer_id, position` | `Breadcrumb` | 현재 위치의 브레드크럼 |

```rust
// src-tauri/src/ipc/commands.rs (추가)

#[tauri::command]
pub async fn nav_push(
    state: State<'_, AppState>,
    file_path: String,
    position: Position,
) -> Result<NavigationEntry, String> {
    state.navigation.push(&PathBuf::from(file_path), position).await
}

#[tauri::command]
pub async fn nav_back(
    state: State<'_, AppState>,
) -> Result<Option<NavigationEntry>, String> {
    Ok(state.navigation.back().await)
}

#[tauri::command]
pub async fn nav_forward(
    state: State<'_, AppState>,
) -> Result<Option<NavigationEntry>, String> {
    Ok(state.navigation.forward().await)
}

#[tauri::command]
pub async fn nav_go_to(
    state: State<'_, AppState>,
    index: usize,
) -> Result<Option<NavigationEntry>, String> {
    Ok(state.navigation.go_to(index).await)
}

#[tauri::command]
pub async fn nav_get_history(
    state: State<'_, AppState>,
) -> Result<NavigationHistory, String> {
    Ok(state.navigation.get_history().await)
}

#[tauri::command]
pub async fn breadcrumb_get(
    state: State<'_, AppState>,
    buffer_id: BufferId,
    position: Position,
) -> Result<Breadcrumb, String> {
    state.navigation.get_breadcrumb(buffer_id, position).await
}
```

```typescript
// src/ipc/commands.ts (추가)

export const nav = {
  push: (filePath: string, position: Position): Promise<NavigationEntry> =>
    invoke("nav_push", { filePath, position }),

  back: (): Promise<NavigationEntry | null> =>
    invoke("nav_back"),

  forward: (): Promise<NavigationEntry | null> =>
    invoke("nav_forward"),

  goTo: (index: number): Promise<NavigationEntry | null> =>
    invoke("nav_go_to", { index }),

  getHistory: (): Promise<NavigationHistory> =>
    invoke("nav_get_history"),

  clear: (): Promise<void> =>
    invoke("nav_clear"),
};

export const breadcrumb = {
  get: (bufferId: BufferId, position: Position): Promise<Breadcrumb> =>
    invoke("breadcrumb_get", { bufferId, position }),
};
```

#### Navigation Service

```rust
// src-tauri/src/services/navigation.rs

use parking_lot::RwLock;
use std::sync::atomic::{AtomicU64, Ordering};

pub struct NavigationService {
    history: RwLock<NavigationHistory>,
    next_id: AtomicU64,
    ast_engine: Arc<RwLock<AstEngine>>,
    buffers: Arc<BufferManager>,
}

impl NavigationService {
    pub fn new(ast_engine: Arc<RwLock<AstEngine>>, buffers: Arc<BufferManager>) -> Self {
        Self {
            history: RwLock::new(NavigationHistory {
                entries: Vec::new(),
                current_index: 0,
                max_entries: 100,
            }),
            next_id: AtomicU64::new(1),
            ast_engine,
            buffers,
        }
    }

    /// Push new navigation entry
    pub async fn push(&self, file_path: &Path, position: Position) -> NavigationEntry {
        let mut history = self.history.write();
        
        // Remove forward history when pushing new entry
        if history.current_index < history.entries.len() {
            history.entries.truncate(history.current_index);
        }

        // Get symbol path at position
        let symbol_path = self.get_symbol_path(file_path, position).await;
        
        let entry = NavigationEntry {
            id: format!("nav-{}", self.next_id.fetch_add(1, Ordering::SeqCst)),
            file_path: file_path.to_path_buf(),
            position,
            symbol_path,
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            label: format!(
                "{}:{}",
                file_path.file_name().unwrap().to_string_lossy(),
                position.line + 1
            ),
        };

        // Avoid duplicate consecutive entries
        if let Some(last) = history.entries.last() {
            if last.file_path == entry.file_path 
                && (last.position.line as i32 - entry.position.line as i32).abs() <= 5 
            {
                // Update existing entry instead of adding new
                let idx = history.entries.len() - 1;
                history.entries[idx] = entry.clone();
                return entry;
            }
        }

        history.entries.push(entry.clone());
        history.current_index = history.entries.len();

        // Enforce max size
        if history.entries.len() > history.max_entries {
            history.entries.remove(0);
            history.current_index -= 1;
        }

        entry
    }

    /// Go back in history
    pub async fn back(&self) -> Option<NavigationEntry> {
        let mut history = self.history.write();
        
        if history.current_index > 1 {
            history.current_index -= 1;
            Some(history.entries[history.current_index - 1].clone())
        } else {
            None
        }
    }

    /// Go forward in history
    pub async fn forward(&self) -> Option<NavigationEntry> {
        let mut history = self.history.write();
        
        if history.current_index < history.entries.len() {
            history.current_index += 1;
            Some(history.entries[history.current_index - 1].clone())
        } else {
            None
        }
    }

    /// Go to specific history index
    pub async fn go_to(&self, index: usize) -> Option<NavigationEntry> {
        let mut history = self.history.write();
        
        if index > 0 && index <= history.entries.len() {
            history.current_index = index;
            Some(history.entries[index - 1].clone())
        } else {
            None
        }
    }

    /// Get full history
    pub async fn get_history(&self) -> NavigationHistory {
        self.history.read().clone()
    }

    /// Get breadcrumb for current position
    pub async fn get_breadcrumb(&self, buffer_id: BufferId, position: Position) -> Breadcrumb {
        let buffer = match self.buffers.get(buffer_id) {
            Some(b) => b,
            None => return Breadcrumb { file_path: PathBuf::new(), segments: Vec::new() },
        };

        let file_path = match &buffer.file_path {
            Some(p) => p.clone(),
            None => return Breadcrumb { file_path: PathBuf::new(), segments: Vec::new() },
        };

        let mut segments = Vec::new();

        // Add directory segments
        let workspace_root = std::env::current_dir().unwrap_or_default();
        if let Ok(relative) = file_path.strip_prefix(&workspace_root) {
            for component in relative.parent().unwrap_or(Path::new("")).components() {
                if let std::path::Component::Normal(name) = component {
                    segments.push(BreadcrumbSegment {
                        label: name.to_string_lossy().to_string(),
                        segment_type: BreadcrumbType::Directory,
                        range: None,
                    });
                }
            }
        }

        // Add file segment
        if let Some(file_name) = file_path.file_name() {
            segments.push(BreadcrumbSegment {
                label: file_name.to_string_lossy().to_string(),
                segment_type: BreadcrumbType::File,
                range: None,
            });
        }

        // Add symbol segments from AST
        let content = buffer.rope.to_string();
        let ast = self.ast_engine.read();
        let symbols = ast.extract_symbols(buffer_id, &content);
        
        // Find containing symbols at position
        let containing = self.find_containing_symbols(&symbols, position);
        for symbol in containing {
            segments.push(BreadcrumbSegment {
                label: symbol.name.clone(),
                segment_type: BreadcrumbType::Symbol,
                range: Some(symbol.range),
            });
        }

        Breadcrumb { file_path, segments }
    }

    async fn get_symbol_path(&self, file_path: &Path, position: Position) -> Vec<String> {
        // Get buffer ID for file
        if let Some(buffer_id) = self.get_buffer_id(file_path) {
            let buffer = self.buffers.get(buffer_id);
            if let Some(buffer) = buffer {
                let content = buffer.rope.to_string();
                let ast = self.ast_engine.read();
                let symbols = ast.extract_symbols(buffer_id, &content);
                
                return self.find_containing_symbols(&symbols, position)
                    .into_iter()
                    .map(|s| s.name.clone())
                    .collect();
            }
        }
        Vec::new()
    }

    fn find_containing_symbols(&self, symbols: &[Symbol], position: Position) -> Vec<&Symbol> {
        let mut result = Vec::new();
        
        for symbol in symbols {
            if self.position_in_range(position, symbol.range) {
                result.push(symbol);
                // Recursively check children
                let children = self.find_containing_symbols(&symbol.children, position);
                result.extend(children);
            }
        }
        
        result
    }

    fn position_in_range(&self, pos: Position, range: Range) -> bool {
        (pos.line > range.start.line || (pos.line == range.start.line && pos.column >= range.start.column))
            && (pos.line < range.end.line || (pos.line == range.end.line && pos.column <= range.end.column))
    }

    fn get_buffer_id(&self, _file_path: &Path) -> Option<BufferId> {
        // Implementation would look up buffer by path
        None
    }
}
```

#### Components

```typescript
// src/components/editor/Breadcrumb.tsx

import { For, createResource, createEffect } from "solid-js";
import { breadcrumb } from "../../ipc/commands";
import type { BufferId, Position } from "../../types/buffer";
import type { BreadcrumbSegment } from "../../types/navigation";

interface BreadcrumbProps {
  bufferId: BufferId;
  position: Position;
  onSegmentClick: (segment: BreadcrumbSegment) => void;
}

export function Breadcrumb(props: BreadcrumbProps) {
  const [data] = createResource(
    () => ({ bufferId: props.bufferId, position: props.position }),
    ({ bufferId, position }) => breadcrumb.get(bufferId, position)
  );

  return (
    <div class="breadcrumb flex items-center gap-1 px-2 py-1 text-sm text-gray-400 bg-gray-900">
      <For each={data()?.segments ?? []}>
        {(segment, index) => (
          <>
            {index() > 0 && <span class="separator mx-1">/</span>}
            <button
              class={`segment hover:text-white transition-colors ${
                segment.segmentType === "Symbol" ? "text-blue-400" : ""
              }`}
              onClick={() => props.onSegmentClick(segment)}
            >
              {segment.label}
            </button>
          </>
        )}
      </For>
    </div>
  );
}
```

```typescript
// src/components/editor/NavigationTrail.tsx

import { For, Show, createResource } from "solid-js";
import { nav } from "../../ipc/commands";
import type { NavigationEntry } from "../../types/navigation";

interface NavigationTrailProps {
  onNavigate: (entry: NavigationEntry) => void;
}

export function NavigationTrail(props: NavigationTrailProps) {
  const [history, { refetch }] = createResource(() => nav.getHistory());

  const handleBack = async () => {
    const entry = await nav.back();
    if (entry) {
      props.onNavigate(entry);
      refetch();
    }
  };

  const handleForward = async () => {
    const entry = await nav.forward();
    if (entry) {
      props.onNavigate(entry);
      refetch();
    }
  };

  const handleGoTo = async (index: number) => {
    const entry = await nav.goTo(index);
    if (entry) {
      props.onNavigate(entry);
      refetch();
    }
  };

  return (
    <div class="navigation-trail flex items-center gap-2 px-2 py-1 bg-gray-800 border-b border-gray-700">
      <button
        class="nav-btn p-1 hover:bg-gray-700 rounded disabled:opacity-50"
        onClick={handleBack}
        disabled={(history()?.currentIndex ?? 0) <= 1}
        title="Go Back (Cmd+[)"
      >
        ←
      </button>
      
      <button
        class="nav-btn p-1 hover:bg-gray-700 rounded disabled:opacity-50"
        onClick={handleForward}
        disabled={(history()?.currentIndex ?? 0) >= (history()?.entries.length ?? 0)}
        title="Go Forward (Cmd+])"
      >
        →
      </button>

      <div class="trail flex items-center gap-1 overflow-x-auto">
        <For each={history()?.entries ?? []}>
          {(entry, index) => (
            <>
              {index() > 0 && <span class="text-gray-600">→</span>}
              <button
                class={`trail-entry px-2 py-0.5 rounded text-sm whitespace-nowrap
                  ${index() + 1 === history()?.currentIndex 
                    ? "bg-blue-600 text-white" 
                    : "text-gray-400 hover:text-white hover:bg-gray-700"
                  }`}
                onClick={() => handleGoTo(index() + 1)}
              >
                {entry.label}
              </button>
            </>
          )}
        </For>
      </div>
    </div>
  );
}
```

---

## 4. Dependency Highlight

### Motivation

파일 간 의존 관계를 파일 탐색기에서 직접 시각화하여 코드베이스 구조 파악을 돕는다.

### User Stories

- As a developer, 현재 파일이 어떤 파일들을 import하는지 한눈에 보고 싶다.
- As a developer, 현재 파일을 import하는 파일들(dependents)을 알고 싶다.
- As a developer, 순환 의존성을 시각적으로 발견하고 싶다.

### Detailed Design

#### Visual Concept

```
┌─────────────────────────────────────┐
│ ▼ src                               │
│   ▼ components                      │
│     ▼ editor                        │
│   ┌──● Editor.tsx ◀────────────┐    │  ← 현재 선택된 파일
│   │    EditorTabs.tsx          │    │
│   │    Cursor.tsx ●────────────┼──┐ │  ← imports (하이라이트 + 선)
│   │    Selection.tsx ●─────────┼──┤ │
│   └─────────────────────────────┘  │ │
│     ▼ layout                        │ │
│   ┌─● ActivityBar.tsx ◀────────────┘ │  ← imported by
│   │                                  │
│   └──────────────────────────────────┘
```

#### Data Types

```rust
// src-tauri/src/services/dependency.rs

use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyInfo {
    pub file_path: PathBuf,
    pub imports: Vec<DependencyLink>,      // Files this file imports
    pub imported_by: Vec<DependencyLink>,  // Files that import this file
    pub has_circular: bool,                // Part of circular dependency
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyLink {
    pub file_path: PathBuf,
    pub import_type: ImportType,
    pub line: u32,                         // Line number of import statement
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ImportType {
    Direct,         // import X from './X'
    Reexport,       // export { X } from './X'
    Dynamic,        // import('./X')
    Require,        // require('./X')
    SideEffect,     // import './X'
}

/// Visual highlight info for file explorer
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyHighlight {
    pub node_id: String,
    pub highlight_type: DependencyHighlightType,
    pub connection_to: Option<String>,     // Node ID to draw line to
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum DependencyHighlightType {
    Selected,       // Currently selected file
    Imports,        // File is imported by selected
    ImportedBy,     // File imports selected
    Circular,       // Part of circular dependency
}
```

```typescript
// src/types/dependency.ts

export interface DependencyInfo {
  filePath: string;
  imports: DependencyLink[];
  importedBy: DependencyLink[];
  hasCircular: boolean;
}

export interface DependencyLink {
  filePath: string;
  importType: "Direct" | "Reexport" | "Dynamic" | "Require" | "SideEffect";
  line: number;
}

export interface DependencyHighlight {
  nodeId: string;
  highlightType: "Selected" | "Imports" | "ImportedBy" | "Circular";
  connectionTo?: string;
}
```

#### IPC Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `dep_get_info` | `file_path: string` | `DependencyInfo` | 파일의 의존성 정보 |
| `dep_get_highlights` | `file_path: string, visible_nodes: string[]` | `DependencyHighlight[]` | 시각화할 하이라이트 |
| `dep_find_circular` | - | `Vec<Vec<string>>` | 순환 의존성 그룹들 |
| `dep_refresh` | `file_path?: string` | `void` | 의존성 다시 분석 |

```rust
// src-tauri/src/ipc/commands.rs (추가)

#[tauri::command]
pub async fn dep_get_info(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<DependencyInfo, String> {
    state.dependency
        .get_info(&PathBuf::from(file_path))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn dep_get_highlights(
    state: State<'_, AppState>,
    file_path: String,
    visible_nodes: Vec<String>,
) -> Result<Vec<DependencyHighlight>, String> {
    Ok(state.dependency.get_highlights(&PathBuf::from(file_path), &visible_nodes))
}

#[tauri::command]
pub async fn dep_find_circular(
    state: State<'_, AppState>,
) -> Result<Vec<Vec<String>>, String> {
    Ok(state.dependency.find_circular_dependencies())
}
```

```typescript
// src/ipc/commands.ts (추가)

export const dep = {
  getInfo: (filePath: string): Promise<DependencyInfo> =>
    invoke("dep_get_info", { filePath }),

  getHighlights: (
    filePath: string,
    visibleNodes: string[]
  ): Promise<DependencyHighlight[]> =>
    invoke("dep_get_highlights", { filePath, visibleNodes }),

  findCircular: (): Promise<string[][]> =>
    invoke("dep_find_circular"),

  refresh: (filePath?: string): Promise<void> =>
    invoke("dep_refresh", { filePath }),
};
```

#### Dependency Service

```rust
// src-tauri/src/services/dependency.rs

use parking_lot::RwLock;
use std::collections::{HashMap, HashSet};
use regex::Regex;

pub struct DependencyService {
    /// file path -> files it imports
    imports_map: RwLock<HashMap<PathBuf, Vec<DependencyLink>>>,
    /// file path -> files that import it
    imported_by_map: RwLock<HashMap<PathBuf, Vec<DependencyLink>>>,
    /// Cached circular dependency groups
    circular_groups: RwLock<Vec<Vec<PathBuf>>>,
}

impl DependencyService {
    pub fn new() -> Self {
        Self {
            imports_map: RwLock::new(HashMap::new()),
            imported_by_map: RwLock::new(HashMap::new()),
            circular_groups: RwLock::new(Vec::new()),
        }
    }

    /// Analyze a file for imports
    pub async fn analyze_file(&self, file_path: &Path) -> Result<(), DependencyError> {
        let content = std::fs::read_to_string(file_path)?;
        let extension = file_path.extension().and_then(|e| e.to_str()).unwrap_or("");
        
        let imports = match extension {
            "ts" | "tsx" | "js" | "jsx" => self.parse_js_imports(&content, file_path),
            "rs" => self.parse_rust_imports(&content, file_path),
            "py" => self.parse_python_imports(&content, file_path),
            "go" => self.parse_go_imports(&content, file_path),
            _ => Vec::new(),
        };

        // Update imports map
        self.imports_map.write().insert(file_path.to_path_buf(), imports.clone());

        // Update imported_by map
        let mut imported_by = self.imported_by_map.write();
        for import in &imports {
            imported_by
                .entry(import.file_path.clone())
                .or_insert_with(Vec::new)
                .push(DependencyLink {
                    file_path: file_path.to_path_buf(),
                    import_type: import.import_type,
                    line: import.line,
                });
        }

        // Recalculate circular dependencies
        self.detect_circular_dependencies();

        Ok(())
    }

    fn parse_js_imports(&self, content: &str, source_file: &Path) -> Vec<DependencyLink> {
        let mut imports = Vec::new();
        let source_dir = source_file.parent().unwrap_or(Path::new(""));

        // Static imports: import X from './path'
        let static_import = Regex::new(
            r#"import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]"#
        ).unwrap();

        // Dynamic imports: import('./path')
        let dynamic_import = Regex::new(r#"import\s*\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap();

        // Require: require('./path')
        let require_import = Regex::new(r#"require\s*\(\s*['"]([^'"]+)['"]\s*\)"#).unwrap();

        // Export from: export { X } from './path'
        let reexport = Regex::new(r#"export\s+(?:\{[^}]*\}|\*)\s+from\s+['"]([^'"]+)['"]"#).unwrap();

        for (line_num, line) in content.lines().enumerate() {
            // Check static imports
            for cap in static_import.captures_iter(line) {
                if let Some(path) = self.resolve_import_path(&cap[1], source_dir) {
                    imports.push(DependencyLink {
                        file_path: path,
                        import_type: ImportType::Direct,
                        line: line_num as u32,
                    });
                }
            }

            // Check dynamic imports
            for cap in dynamic_import.captures_iter(line) {
                if let Some(path) = self.resolve_import_path(&cap[1], source_dir) {
                    imports.push(DependencyLink {
                        file_path: path,
                        import_type: ImportType::Dynamic,
                        line: line_num as u32,
                    });
                }
            }

            // Check requires
            for cap in require_import.captures_iter(line) {
                if let Some(path) = self.resolve_import_path(&cap[1], source_dir) {
                    imports.push(DependencyLink {
                        file_path: path,
                        import_type: ImportType::Require,
                        line: line_num as u32,
                    });
                }
            }

            // Check re-exports
            for cap in reexport.captures_iter(line) {
                if let Some(path) = self.resolve_import_path(&cap[1], source_dir) {
                    imports.push(DependencyLink {
                        file_path: path,
                        import_type: ImportType::Reexport,
                        line: line_num as u32,
                    });
                }
            }
        }

        imports
    }

    fn resolve_import_path(&self, import_str: &str, source_dir: &Path) -> Option<PathBuf> {
        // Skip node_modules / external packages
        if !import_str.starts_with('.') && !import_str.starts_with('/') {
            return None;
        }

        let base_path = source_dir.join(import_str);
        
        // Try exact path
        if base_path.exists() {
            return Some(base_path.canonicalize().ok()?);
        }

        // Try with extensions
        for ext in &["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"] {
            let with_ext = PathBuf::from(format!("{}{}", base_path.display(), ext));
            if with_ext.exists() {
                return Some(with_ext.canonicalize().ok()?);
            }
        }

        None
    }

    fn parse_rust_imports(&self, content: &str, source_file: &Path) -> Vec<DependencyLink> {
        // Rust uses mod/use statements, more complex resolution
        // Simplified implementation
        Vec::new()
    }

    fn parse_python_imports(&self, content: &str, source_file: &Path) -> Vec<DependencyLink> {
        // Python import/from statements
        Vec::new()
    }

    fn parse_go_imports(&self, content: &str, source_file: &Path) -> Vec<DependencyLink> {
        // Go import statements
        Vec::new()
    }

    /// Get dependency info for a file
    pub async fn get_info(&self, file_path: &Path) -> Result<DependencyInfo, DependencyError> {
        let imports = self.imports_map.read()
            .get(file_path)
            .cloned()
            .unwrap_or_default();

        let imported_by = self.imported_by_map.read()
            .get(file_path)
            .cloned()
            .unwrap_or_default();

        let has_circular = self.circular_groups.read()
            .iter()
            .any(|group| group.contains(&file_path.to_path_buf()));

        Ok(DependencyInfo {
            file_path: file_path.to_path_buf(),
            imports,
            imported_by,
            has_circular,
        })
    }

    /// Get highlights for file explorer visualization
    pub fn get_highlights(
        &self,
        selected_file: &Path,
        visible_node_ids: &[String],
    ) -> Vec<DependencyHighlight> {
        let mut highlights = Vec::new();
        
        // Highlight selected file
        let selected_id = self.path_to_node_id(selected_file);
        highlights.push(DependencyHighlight {
            node_id: selected_id.clone(),
            highlight_type: DependencyHighlightType::Selected,
            connection_to: None,
        });

        // Highlight files that selected imports
        if let Some(imports) = self.imports_map.read().get(selected_file) {
            for import in imports {
                let node_id = self.path_to_node_id(&import.file_path);
                if visible_node_ids.contains(&node_id) {
                    highlights.push(DependencyHighlight {
                        node_id: node_id.clone(),
                        highlight_type: DependencyHighlightType::Imports,
                        connection_to: Some(selected_id.clone()),
                    });
                }
            }
        }

        // Highlight files that import selected
        if let Some(imported_by) = self.imported_by_map.read().get(selected_file) {
            for link in imported_by {
                let node_id = self.path_to_node_id(&link.file_path);
                if visible_node_ids.contains(&node_id) {
                    highlights.push(DependencyHighlight {
                        node_id,
                        highlight_type: DependencyHighlightType::ImportedBy,
                        connection_to: Some(selected_id.clone()),
                    });
                }
            }
        }

        // Highlight circular dependencies
        for group in self.circular_groups.read().iter() {
            if group.contains(&selected_file.to_path_buf()) {
                for path in group {
                    let node_id = self.path_to_node_id(path);
                    if visible_node_ids.contains(&node_id) && path != selected_file {
                        highlights.push(DependencyHighlight {
                            node_id,
                            highlight_type: DependencyHighlightType::Circular,
                            connection_to: Some(selected_id.clone()),
                        });
                    }
                }
            }
        }

        highlights
    }

    /// Find all circular dependencies
    pub fn find_circular_dependencies(&self) -> Vec<Vec<String>> {
        self.circular_groups.read()
            .iter()
            .map(|group| group.iter().map(|p| p.to_string_lossy().to_string()).collect())
            .collect()
    }

    /// Detect circular dependencies using DFS
    fn detect_circular_dependencies(&self) {
        let imports = self.imports_map.read();
        let mut visited = HashSet::new();
        let mut rec_stack = HashSet::new();
        let mut circular_groups = Vec::new();

        for file in imports.keys() {
            if !visited.contains(file) {
                let mut path = Vec::new();
                self.dfs_circular(
                    file,
                    &imports,
                    &mut visited,
                    &mut rec_stack,
                    &mut path,
                    &mut circular_groups,
                );
            }
        }

        *self.circular_groups.write() = circular_groups;
    }

    fn dfs_circular(
        &self,
        node: &PathBuf,
        imports: &HashMap<PathBuf, Vec<DependencyLink>>,
        visited: &mut HashSet<PathBuf>,
        rec_stack: &mut HashSet<PathBuf>,
        path: &mut Vec<PathBuf>,
        circular_groups: &mut Vec<Vec<PathBuf>>,
    ) {
        visited.insert(node.clone());
        rec_stack.insert(node.clone());
        path.push(node.clone());

        if let Some(deps) = imports.get(node) {
            for dep in deps {
                if !visited.contains(&dep.file_path) {
                    self.dfs_circular(
                        &dep.file_path,
                        imports,
                        visited,
                        rec_stack,
                        path,
                        circular_groups,
                    );
                } else if rec_stack.contains(&dep.file_path) {
                    // Found circular dependency
                    let cycle_start = path.iter().position(|p| p == &dep.file_path).unwrap();
                    let cycle: Vec<PathBuf> = path[cycle_start..].to_vec();
                    circular_groups.push(cycle);
                }
            }
        }

        path.pop();
        rec_stack.remove(node);
    }

    fn path_to_node_id(&self, path: &Path) -> String {
        // Hash the path for consistent node ID
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        path.hash(&mut hasher);
        format!("node-{}", hasher.finish())
    }
}

#[derive(Debug)]
pub enum DependencyError {
    IoError(std::io::Error),
    ParseError(String),
}

impl From<std::io::Error> for DependencyError {
    fn from(e: std::io::Error) -> Self {
        DependencyError::IoError(e)
    }
}
```

#### Connection Lines Component (PixiJS)

```typescript
// src/canvas/DependencyLines.ts

import { Application, Graphics } from "pixi.js";
import type { DependencyHighlight } from "../types/dependency";

interface NodePosition {
  nodeId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class DependencyLines {
  private graphics: Graphics;
  private app: Application;

  constructor(app: Application) {
    this.app = app;
    this.graphics = new Graphics();
    app.stage.addChild(this.graphics);
  }

  draw(highlights: DependencyHighlight[], nodePositions: Map<string, NodePosition>) {
    this.graphics.clear();

    for (const highlight of highlights) {
      if (!highlight.connectionTo) continue;

      const fromPos = nodePositions.get(highlight.nodeId);
      const toPos = nodePositions.get(highlight.connectionTo);
      
      if (!fromPos || !toPos) continue;

      const color = this.getColor(highlight.highlightType);
      const fromX = fromPos.x;
      const fromY = fromPos.y + fromPos.height / 2;
      const toX = toPos.x;
      const toY = toPos.y + toPos.height / 2;

      // Draw bezier curve
      this.graphics.moveTo(fromX, fromY);
      
      const controlX = Math.min(fromX, toX) - 20;
      this.graphics.bezierCurveTo(
        controlX, fromY,
        controlX, toY,
        toX, toY
      );
      
      this.graphics.stroke({ width: 2, color, alpha: 0.6 });

      // Draw arrow at end
      this.drawArrow(toX, toY, fromY < toY ? -1 : 1, color);
    }
  }

  private getColor(type: DependencyHighlight["highlightType"]): number {
    switch (type) {
      case "Imports": return 0x22c55e;      // green
      case "ImportedBy": return 0x3b82f6;   // blue
      case "Circular": return 0xef4444;     // red
      default: return 0x888888;
    }
  }

  private drawArrow(x: number, y: number, direction: number, color: number) {
    const size = 6;
    this.graphics.moveTo(x, y);
    this.graphics.lineTo(x - size, y - size * direction);
    this.graphics.lineTo(x + size, y - size * direction);
    this.graphics.lineTo(x, y);
    this.graphics.fill({ color });
  }

  destroy() {
    this.graphics.destroy();
  }
}
```

---

## 5. Related Files

### Motivation

연관된 파일들(컴포넌트 + 테스트 + 스타일 + 타입)을 그룹으로 보여줘 탐색 효율을 높인다.

### User Stories

- As a developer, 컴포넌트와 관련된 테스트, 스타일, 타입 파일을 한번에 보고 싶다.
- As a developer, 그룹으로 묶인 파일들을 한번에 열거나 접고 싶다.

### Detailed Design

#### Related File Patterns

```rust
// src-tauri/src/services/related_files.rs

/// Patterns for detecting related files
pub struct RelatedFilePatterns {
    /// Base patterns: if file is `Foo.tsx`, look for `Foo.test.tsx`, `Foo.styles.ts`, etc.
    pub patterns: Vec<RelatedPattern>,
}

#[derive(Debug, Clone)]
pub struct RelatedPattern {
    pub name: String,
    pub suffixes: Vec<String>,
    pub icon: String,
}

impl Default for RelatedFilePatterns {
    fn default() -> Self {
        Self {
            patterns: vec![
                RelatedPattern {
                    name: "Test".to_string(),
                    suffixes: vec![
                        ".test.ts".to_string(),
                        ".test.tsx".to_string(),
                        ".spec.ts".to_string(),
                        ".spec.tsx".to_string(),
                        "_test.go".to_string(),
                        "_test.rs".to_string(),
                        "_test.py".to_string(),
                        ".test.js".to_string(),
                    ],
                    icon: "test".to_string(),
                },
                RelatedPattern {
                    name: "Style".to_string(),
                    suffixes: vec![
                        ".module.css".to_string(),
                        ".module.scss".to_string(),
                        ".styles.ts".to_string(),
                        ".css.ts".to_string(),
                        ".styled.ts".to_string(),
                    ],
                    icon: "style".to_string(),
                },
                RelatedPattern {
                    name: "Types".to_string(),
                    suffixes: vec![
                        ".types.ts".to_string(),
                        ".d.ts".to_string(),
                        ".interface.ts".to_string(),
                    ],
                    icon: "type".to_string(),
                },
                RelatedPattern {
                    name: "Story".to_string(),
                    suffixes: vec![
                        ".stories.tsx".to_string(),
                        ".stories.ts".to_string(),
                    ],
                    icon: "story".to_string(),
                },
            ],
        }
    }
}
```

#### Data Types

```rust
// src-tauri/src/services/related_files.rs

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelatedFileGroup {
    pub primary_file: PathBuf,
    pub primary_name: String,         // e.g., "Editor"
    pub related_files: Vec<RelatedFile>,
    pub is_expanded: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelatedFile {
    pub file_path: PathBuf,
    pub relation_type: String,        // "Test", "Style", "Types", etc.
    pub icon: String,
}

/// View mode for file explorer
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
pub enum FileExplorerViewMode {
    #[default]
    Tree,           // Traditional tree view
    Grouped,        // Related files grouped together
}
```

```typescript
// src/types/relatedFiles.ts

export interface RelatedFileGroup {
  primaryFile: string;
  primaryName: string;
  relatedFiles: RelatedFile[];
  isExpanded: boolean;
}

export interface RelatedFile {
  filePath: string;
  relationType: string;
  icon: string;
}

export type FileExplorerViewMode = "Tree" | "Grouped";
```

#### IPC Commands

| Command | Input | Output | Description |
|---------|-------|--------|-------------|
| `related_get_group` | `file_path: string` | `RelatedFileGroup?` | 파일의 관련 파일 그룹 |
| `related_get_all_groups` | `directory: string` | `RelatedFileGroup[]` | 디렉토리 내 모든 그룹 |
| `related_set_view_mode` | `mode: ViewMode` | `void` | 뷰 모드 변경 |

```rust
// src-tauri/src/ipc/commands.rs (추가)

#[tauri::command]
pub async fn related_get_group(
    state: State<'_, AppState>,
    file_path: String,
) -> Result<Option<RelatedFileGroup>, String> {
    Ok(state.related_files.get_group(&PathBuf::from(file_path)))
}

#[tauri::command]
pub async fn related_get_all_groups(
    state: State<'_, AppState>,
    directory: String,
) -> Result<Vec<RelatedFileGroup>, String> {
    Ok(state.related_files.get_all_groups(&PathBuf::from(directory)))
}
```

#### Related Files Service

```rust
// src-tauri/src/services/related_files.rs

pub struct RelatedFilesService {
    patterns: RelatedFilePatterns,
    groups_cache: RwLock<HashMap<PathBuf, RelatedFileGroup>>,
}

impl RelatedFilesService {
    pub fn new() -> Self {
        Self {
            patterns: RelatedFilePatterns::default(),
            groups_cache: RwLock::new(HashMap::new()),
        }
    }

    /// Get related file group for a file
    pub fn get_group(&self, file_path: &Path) -> Option<RelatedFileGroup> {
        let file_name = file_path.file_name()?.to_str()?;
        let dir = file_path.parent()?;

        // Extract base name (e.g., "Editor" from "Editor.tsx")
        let base_name = self.extract_base_name(file_name)?;
        
        // Find related files
        let mut related_files = Vec::new();
        
        for pattern in &self.patterns.patterns {
            for suffix in &pattern.suffixes {
                let related_name = format!("{}{}", base_name, suffix);
                let related_path = dir.join(&related_name);
                
                if related_path.exists() && related_path != file_path {
                    related_files.push(RelatedFile {
                        file_path: related_path,
                        relation_type: pattern.name.clone(),
                        icon: pattern.icon.clone(),
                    });
                }
            }
        }

        if related_files.is_empty() {
            return None;
        }

        Some(RelatedFileGroup {
            primary_file: file_path.to_path_buf(),
            primary_name: base_name,
            related_files,
            is_expanded: false,
        })
    }

    /// Get all related file groups in a directory
    pub fn get_all_groups(&self, directory: &Path) -> Vec<RelatedFileGroup> {
        let mut groups = Vec::new();
        let mut processed = HashSet::new();

        if let Ok(entries) = std::fs::read_dir(directory) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                
                if path.is_file() && !processed.contains(&path) {
                    if let Some(group) = self.get_group(&path) {
                        // Mark all files in group as processed
                        processed.insert(path.clone());
                        for related in &group.related_files {
                            processed.insert(related.file_path.clone());
                        }
                        groups.push(group);
                    }
                }
            }
        }

        groups
    }

    fn extract_base_name(&self, file_name: &str) -> Option<String> {
        // Handle various patterns:
        // Editor.tsx -> Editor
        // Editor.test.tsx -> Editor
        // Editor.module.css -> Editor
        // editor_test.go -> editor

        // Remove known suffixes first
        let mut name = file_name.to_string();
        
        // Remove test/spec/stories suffixes
        for pattern in &[".test", ".spec", ".stories", ".module", ".styles", ".styled", ".types", ".d"] {
            if let Some(idx) = name.find(pattern) {
                name = name[..idx].to_string();
                break;
            }
        }

        // For Go: remove _test suffix
        if name.ends_with("_test") {
            name = name[..name.len() - 5].to_string();
        }

        // Remove file extension
        if let Some(idx) = name.rfind('.') {
            name = name[..idx].to_string();
        }

        if name.is_empty() {
            None
        } else {
            Some(name)
        }
    }
}
```

#### Grouped View Component

```typescript
// src/components/explorer/RelatedFileGroup.tsx

import { For, Show } from "solid-js";
import type { RelatedFileGroup as RelatedFileGroupType } from "../../types/relatedFiles";

interface Props {
  group: RelatedFileGroupType;
  onToggle: (group: RelatedFileGroupType) => void;
  onOpenFile: (filePath: string) => void;
}

export function RelatedFileGroup(props: Props) {
  return (
    <div class="related-group border border-gray-700 rounded mb-1">
      {/* Primary file header */}
      <div
        class="group-header flex items-center px-2 py-1 cursor-pointer hover:bg-gray-800"
        onClick={() => props.onToggle(props.group)}
      >
        <span class="expand-icon mr-1">
          {props.group.isExpanded ? "▼" : "▶"}
        </span>
        <span class="icon mr-1">📄</span>
        <span class="name font-medium">{props.group.primaryName}</span>
        <span class="count ml-auto text-xs text-gray-500">
          +{props.group.relatedFiles.length}
        </span>
      </div>

      {/* Related files (when expanded) */}
      <Show when={props.group.isExpanded}>
        <div class="related-files pl-4 border-t border-gray-700">
          {/* Primary file */}
          <div
            class="file-row flex items-center px-2 py-1 cursor-pointer hover:bg-gray-800"
            onClick={() => props.onOpenFile(props.group.primaryFile)}
          >
            <span class="icon mr-1">📄</span>
            <span class="name">{getFileName(props.group.primaryFile)}</span>
            <span class="tag ml-2 text-xs px-1 rounded bg-blue-900 text-blue-300">
              Primary
            </span>
          </div>

          {/* Related files */}
          <For each={props.group.relatedFiles}>
            {(file) => (
              <div
                class="file-row flex items-center px-2 py-1 cursor-pointer hover:bg-gray-800"
                onClick={() => props.onOpenFile(file.filePath)}
              >
                <span class="icon mr-1">{getIcon(file.icon)}</span>
                <span class="name text-gray-400">
                  {getFileName(file.filePath)}
                </span>
                <span class={`tag ml-2 text-xs px-1 rounded ${getTagColor(file.relationType)}`}>
                  {file.relationType}
                </span>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

function getIcon(iconType: string): string {
  switch (iconType) {
    case "test": return "🧪";
    case "style": return "🎨";
    case "type": return "📘";
    case "story": return "📖";
    default: return "📄";
  }
}

function getTagColor(type: string): string {
  switch (type) {
    case "Test": return "bg-green-900 text-green-300";
    case "Style": return "bg-pink-900 text-pink-300";
    case "Types": return "bg-yellow-900 text-yellow-300";
    case "Story": return "bg-purple-900 text-purple-300";
    default: return "bg-gray-700 text-gray-300";
  }
}
```

---

## Edge Cases

### Tree Viewer
- 매우 깊은 디렉토리 (10+ depth) → 색상 순환
- 빈 디렉토리 → 표시하되 확장 불가
- 심볼릭 링크 → 아이콘 구분, 순환 방지
- 숨김 파일 → 토글 옵션

### Tree Fold
- 확장 중 파일 삭제됨 → graceful fallback
- 매우 큰 디렉토리 확장 → 청크 로딩 + 프로그레스

### Navigation Trail
- 삭제된 파일로의 네비게이션 → 경고 표시 + 스킵
- 매우 긴 히스토리 → 가상화 또는 페이지네이션

### Dependency Highlight
- 순환 의존성 많음 → 성능 최적화 (캐싱)
- 외부 패키지 → 표시 안 함 (node_modules)
- 동적 import → 정적 분석 한계 명시

### Related Files
- 중첩 관계 (A.test.spec.ts) → 가장 긴 매칭
- 다른 디렉토리의 관련 파일 → 옵션으로 포함/제외

---

## Dependencies

- **Buffer System** (architecture.md) - 파일 내용 읽기
- **AST Engine** (architecture.md) - 심볼 추출, 브레드크럼
- **Index Manager** (architecture.md) - 의존성 그래프
- **PixiJS** - 의존성 연결선 렌더링

---

## Open Questions

1. **Sticky Header 최대 개수** - 화면에 너무 많은 스티키 헤더는 공간 낭비?
2. **의존성 분석 범위** - 프로젝트 전체? 열린 파일만?
3. **Related Files 커스텀 패턴** - 사용자 정의 패턴 지원?
4. **Navigation Trail 영속성** - 세션 간 유지?
