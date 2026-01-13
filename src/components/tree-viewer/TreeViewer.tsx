/**
 * Tree Viewer Component (Figma-style)
 * 
 * Visualizes code nesting depth with colored containers and provides
 * folding functionality with smooth animations and hover effects.
 */

import { createSignal, createEffect, For, Show, type JSX } from "solid-js";
import { getDepthRegions, getFoldState, toggleFold } from "../../ipc/commands";
import type { DepthRegionInfo, FoldState } from "../../ipc/types";

interface TreeViewerProps {
  bufferId: string;
  lineCount: number;
  lineHeight?: number;
  onFoldToggle?: (line: number, isFolded: boolean) => void;
}

// Layout constants (must match Editor.tsx)
const CHAR_WIDTH = 7.85;
const GUTTER_WIDTH = 50;
const CONTENT_PADDING = 10;
const LEFT_OFFSET = GUTTER_WIDTH + CONTENT_PADDING;
const INDENT_WIDTH = CHAR_WIDTH * 2;

// Figma-inspired depth colors (subtle, professional)
const DEPTH_COLORS = [
  { bg: "rgba(59, 130, 246, 0.03)", border: "rgba(59, 130, 246, 0.15)" },  // blue
  { bg: "rgba(139, 92, 246, 0.04)", border: "rgba(139, 92, 246, 0.18)" },  // purple
  { bg: "rgba(236, 72, 153, 0.04)", border: "rgba(236, 72, 153, 0.18)" },  // pink
  { bg: "rgba(245, 158, 11, 0.04)", border: "rgba(245, 158, 11, 0.18)" },  // amber
  { bg: "rgba(16, 185, 129, 0.04)", border: "rgba(16, 185, 129, 0.18)" },  // green
  { bg: "rgba(99, 102, 241, 0.04)", border: "rgba(99, 102, 241, 0.18)" },  // indigo
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

  const lineHeight = () => props.lineHeight ?? 20;

  // Render depth containers for visible lines
  const renderDepthContainers = () => {
    const containers: JSX.Element[] = [];
    const regions = depthRegions();
    const state = foldState();
    
    for (const region of regions) {
      if (region.depth === 0) continue;
      
      const colorIndex = Math.min(region.depth - 1, DEPTH_COLORS.length - 1);
      const colors = DEPTH_COLORS[colorIndex] ?? DEPTH_COLORS[0];
      
      // Check if this region is folded
      const isFolded = state?.folded_lines.includes(region.start_line + 1) ?? false;
      const displayHeight = isFolded 
        ? lineHeight() 
        : (region.end_line - region.start_line + 1) * lineHeight();
      
      containers.push(
        <div
          class="depth-container transition-all duration-200 ease-out"
          style={{
            position: "absolute",
            left: `${LEFT_OFFSET + (region.depth - 1) * INDENT_WIDTH}px`,
            top: `${region.start_line * lineHeight()}px`,
            height: `${displayHeight}px`,
            right: "0",
            "background-color": colors?.bg ?? "transparent",
            "border-left": `2px solid ${colors?.border ?? "transparent"}`,
            "border-radius": "0 4px 4px 0",
            "pointer-events": "none",
            "z-index": `${10 - region.depth}`,
          }}
        />
      );
    }
    
    return containers;
  };

  // Check if a line is folded (collapsed)
  const isLineFolded = (lineNumber: number): boolean => {
    const state = foldState();
    if (!state || !state.fold_ranges[lineNumber]) return false;
    return state.folded_lines.includes(lineNumber + 1);
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
                class="fold-button absolute rounded-sm transition-all duration-150 flex items-center justify-center opacity-0 hover:opacity-100 group-hover:opacity-60"
                classList={{
                  "bg-blue-500/80 opacity-100": isLineFolded(lineNumber),
                  "bg-gray-600/60 hover:bg-blue-500/80": !isLineFolded(lineNumber),
                }}
                style={{
                  top: `${lineNumber * lineHeight() + 2}px`,
                  left: `${LEFT_OFFSET + (getLineDepth(lineNumber) * INDENT_WIDTH) - 18}px`,
                  width: "14px",
                  height: "14px",
                  "z-index": "100",
                }}
                onClick={() => handleToggleFold(lineNumber)}
                title={isLineFolded(lineNumber) ? "Expand" : "Collapse"}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  class="text-white transition-transform duration-150"
                  classList={{
                    "rotate-90": !isLineFolded(lineNumber),
                    "rotate-0": isLineFolded(lineNumber),
                  }}
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
