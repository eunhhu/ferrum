/**
 * Tree Viewer Component
 * 
 * Visualizes code nesting depth with colored containers and provides
 * folding functionality.
 */

import { createSignal, createEffect, For, Show, type JSX } from "solid-js";
import { getDepthRegions, getFoldState, toggleFold } from "../../ipc/commands";
import type { DepthRegionInfo, FoldState } from "../../ipc/types";

interface TreeViewerProps {
  bufferId: string;
  lineCount: number;
}

// Layout constants (must match Editor.tsx)
const CHAR_WIDTH = 7.85;
const GUTTER_WIDTH = 50;
const CONTENT_PADDING = 10;
const LEFT_OFFSET = GUTTER_WIDTH + CONTENT_PADDING;
const INDENT_WIDTH = CHAR_WIDTH * 2; // 2 spaces per indentation

// Depth colors (HSL for smooth gradient)
const DEPTH_COLORS = [
  "hsl(210, 100%, 97%)",  // depth 0: very light blue
  "hsl(210, 95%, 94%)",   // depth 1
  "hsl(210, 90%, 91%)",   // depth 2
  "hsl(210, 85%, 88%)",   // depth 3
  "hsl(210, 80%, 85%)",   // depth 4
  "hsl(210, 75%, 82%)",   // depth 5
];

export function TreeViewer(props: TreeViewerProps) {
  const [depthRegions, setDepthRegions] = createSignal<DepthRegionInfo[]>([]);
  const [foldState, setFoldState] = createSignal<FoldState | null>(null);

  // Load depth and fold data
  const loadDepthData = async () => {
    try {
      const regions = await getDepthRegions(props.bufferId);
      setDepthRegions(regions);
    } catch (e) {
      console.error("Failed to load depth regions:", e);
    }
  };

  const loadFoldState = async () => {
    try {
      const state = await getFoldState(props.bufferId);
      setFoldState(state);
    } catch (e) {
      console.error("Failed to load fold state:", e);
    }
  };

  // Toggle fold at a specific line
  const handleToggleFold = async (line: number) => {
    try {
      const changed = await toggleFold(props.bufferId, line);
      if (changed) {
        await loadFoldState();
      }
    } catch (e) {
      console.error("Failed to toggle fold:", e);
    }
  };

  // Load data on mount and when buffer changes
  createEffect(() => {
    if (props.bufferId) {
      loadDepthData();
      loadFoldState();
    }
  });

  // Get depth for a specific line
  const getLineDepth = (lineNumber: number): number => {
    const regions = depthRegions();
    for (const region of regions) {
      if (lineNumber >= region.start_line && lineNumber <= region.end_line) {
        return region.depth;
      }
    }
    return 0;
  };

  // Check if a line is the start of a foldable region
  const isFoldableStart = (lineNumber: number): boolean => {
    const state = foldState();
    if (!state) return false;
    return lineNumber in state.fold_ranges;
  };

  // Check if a line is hidden by folding
  const isLineHidden = (lineNumber: number): boolean => {
    const state = foldState();
    if (!state) return false;
    return state.folded_lines.includes(lineNumber);
  };

  // Render depth containers for visible lines
  const renderDepthContainers = () => {
    const containers: JSX.Element[] = [];
    const regions = depthRegions();
    
    for (const region of regions) {
      if (region.depth === 0) continue;
      
      const color = DEPTH_COLORS[Math.min(region.depth, DEPTH_COLORS.length - 1)];
      
      containers.push(
        <div
          class="depth-container"
          style={{
            position: "absolute",
            left: `${LEFT_OFFSET + (region.depth - 1) * INDENT_WIDTH}px`,
            top: `${region.start_line * 20}px`,
            height: `${(region.end_line - region.start_line + 1) * 20}px`,
            right: "0",
            "background-color": color,
            "border-left": `1px solid ${color?.replace("97%", "80%") ?? "#ccc"}`,
            "pointer-events": "none",
            "z-index": `${10 - region.depth}`,
            "opacity": "0.5",
          }}
        />
      );
    }
    
    return containers;
  };

  return (
    <div class="tree-viewer absolute inset-0 pointer-events-none z-10">
      {/* Depth visualization containers */}
      {renderDepthContainers()}
      
      {/* Fold controls (clickable) */}
      <div class="fold-controls pointer-events-auto z-20">
        <For each={Array.from({ length: props.lineCount }, (_, i) => i)}>
          {(lineNumber) => (
            <Show when={isFoldableStart(lineNumber) && !isLineHidden(lineNumber)}>
              <button
                class="fold-button absolute bg-gray-700 hover:bg-blue-600 rounded transition-colors flex items-center justify-center"
                style={{
                  top: `${lineNumber * 20 + 2}px`,
                  left: `${LEFT_OFFSET + (getLineDepth(lineNumber) * INDENT_WIDTH) - 20}px`,
                  width: "16px",
                  height: "16px",
                  "z-index": "100",
                }}
                onClick={() => handleToggleFold(lineNumber)}
                title="Toggle fold"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  class="text-white"
                >
                  <path d="M6 4l4 4-4 4z" />
                </svg>
              </button>
            </Show>
          )}
        </For>
      </div>
    </div>
  );
}
