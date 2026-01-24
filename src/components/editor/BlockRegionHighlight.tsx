/**
 * Block Region Highlight Component
 *
 * Highlights the current code block/scope that contains the cursor.
 * Uses tree-sitter AST to determine block boundaries.
 */

import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { getDepthRegions } from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";
import type { DepthRegionInfo } from "../../ipc/types";

interface BlockRegionHighlightProps {
  bufferId: string | null;
  currentLine: number;
  lineHeight: number;
  visibleStartLine: number;
  visibleEndLine: number;
  leftOffset: number;
  enabled: boolean;
}

// Colors for different nesting depths (subtle backgrounds)
const BLOCK_COLORS = [
  "rgba(59, 130, 246, 0.04)", // blue
  "rgba(139, 92, 246, 0.05)", // purple
  "rgba(236, 72, 153, 0.05)", // pink
  "rgba(245, 158, 11, 0.05)", // amber
  "rgba(16, 185, 129, 0.05)", // green
];

// Border colors for block markers
const BORDER_COLORS = [
  "rgba(59, 130, 246, 0.3)",
  "rgba(139, 92, 246, 0.35)",
  "rgba(236, 72, 153, 0.35)",
  "rgba(245, 158, 11, 0.35)",
  "rgba(16, 185, 129, 0.35)",
];

export function BlockRegionHighlight(props: BlockRegionHighlightProps) {
  const [regions, setRegions] = createSignal<DepthRegionInfo[]>([]);
  const [activeRegions, setActiveRegions] = createSignal<DepthRegionInfo[]>([]);
  const [loading, setLoading] = createSignal(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Load depth regions when buffer changes
  createEffect(() => {
    if (!(props.enabled && props.bufferId)) {
      setRegions([]);
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadRegions(props.bufferId!);
    }, 100);
  });

  // Find regions containing current cursor line
  createEffect(() => {
    const allRegions = regions();
    const line = props.currentLine;

    // Find all regions that contain the current line
    const containing = allRegions.filter(
      (r) => line >= r.start_line && line <= r.end_line && r.depth > 0
    );

    // Sort by depth (innermost first)
    containing.sort((a, b) => b.depth - a.depth);

    setActiveRegions(containing);
  });

  const loadRegions = async (bufferId: string) => {
    if (!isTauriEnvironment()) {
      setRegions([]);
      return;
    }

    setLoading(true);
    try {
      const result = await getDepthRegions(bufferId);
      setRegions(result);
    } catch (e) {
      console.error("Failed to load depth regions:", e);
      setRegions([]);
    } finally {
      setLoading(false);
    }
  };

  // Get the innermost active region (current block)
  const currentBlock = () => activeRegions()[0] ?? null;

  // Get parent blocks (for nested highlighting)
  const parentBlocks = () => activeRegions().slice(1, 3); // Max 2 parent levels

  const getColor = (depth: number, type: "bg" | "border"): string => {
    const colors = type === "bg" ? BLOCK_COLORS : BORDER_COLORS;
    return colors[Math.min(depth - 1, colors.length - 1)] ?? colors[0]!;
  };

  // Check if a region is visible in the viewport
  const isVisible = (region: DepthRegionInfo): boolean => {
    return region.end_line >= props.visibleStartLine && region.start_line <= props.visibleEndLine;
  };

  // Calculate visual position for a region
  const getRegionStyle = (region: DepthRegionInfo, isActive: boolean) => {
    // Clamp to visible area
    const visibleTop = Math.max(
      0,
      (Math.max(region.start_line, props.visibleStartLine) - props.visibleStartLine) *
        props.lineHeight
    );
    const visibleBottom = Math.min(
      (props.visibleEndLine - props.visibleStartLine + 1) * props.lineHeight,
      (region.end_line - props.visibleStartLine + 1) * props.lineHeight
    );
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    return {
      top: `${visibleTop}px`,
      height: `${visibleHeight}px`,
      left: `${props.leftOffset + region.depth * 8}px`,
      "background-color": isActive ? getColor(region.depth, "bg") : "transparent",
      "border-left": isActive ? `2px solid ${getColor(region.depth, "border")}` : "none",
    };
  };

  return (
    <Show when={props.enabled}>
      <div class="block-region-highlight absolute inset-0 pointer-events-none z-5">
        {/* Parent block highlights (subtle) */}
        <For each={parentBlocks().filter(isVisible)}>
          {(region) => (
            <div
              class="absolute right-0 transition-all duration-150"
              style={{
                ...getRegionStyle(region, true),
                opacity: 0.5,
              }}
            />
          )}
        </For>

        {/* Current block highlight (prominent) */}
        <Show when={currentBlock() && isVisible(currentBlock()!)}>
          <div
            class="absolute right-0 transition-all duration-150"
            style={getRegionStyle(currentBlock()!, true)}
          />
        </Show>

        {/* Block start/end markers */}
        <Show when={currentBlock()}>
          {(block) => (
            <>
              {/* Start marker */}
              <Show when={block().start_line >= props.visibleStartLine}>
                <div
                  class="absolute flex items-center gap-1 text-[10px] font-mono transition-opacity duration-150"
                  style={{
                    top: `${(block().start_line - props.visibleStartLine) * props.lineHeight}px`,
                    right: "8px",
                    color: getColor(block().depth, "border"),
                    opacity: 0.7,
                  }}
                >
                  <span>⌈</span>
                  <span class="bg-bg-secondary/80 px-1 rounded text-text-tertiary">
                    {block().node_type ?? "block"}
                  </span>
                </div>
              </Show>

              {/* End marker */}
              <Show when={block().end_line <= props.visibleEndLine}>
                <div
                  class="absolute flex items-center gap-1 text-[10px] font-mono transition-opacity duration-150"
                  style={{
                    top: `${(block().end_line - props.visibleStartLine) * props.lineHeight}px`,
                    right: "8px",
                    color: getColor(block().depth, "border"),
                    opacity: 0.7,
                  }}
                >
                  <span>⌊</span>
                </div>
              </Show>
            </>
          )}
        </Show>

        {/* Depth indicator */}
        <Show when={activeRegions().length > 0}>
          <div class="absolute bottom-2 right-2 flex items-center gap-1 bg-bg-secondary/80 px-2 py-1 rounded text-[10px] text-text-tertiary">
            <span>Depth:</span>
            <For each={activeRegions().slice(0, 4)}>
              {(region) => (
                <span
                  class="w-2 h-2 rounded-full"
                  style={{
                    "background-color": getColor(region.depth, "border"),
                  }}
                  title={`Level ${region.depth}: ${region.node_type ?? "block"}`}
                />
              )}
            </For>
            <Show when={activeRegions().length > 4}>
              <span class="text-text-quaternary">+{activeRegions().length - 4}</span>
            </Show>
          </div>
        </Show>

        {/* Loading indicator */}
        <Show when={loading()}>
          <div class="absolute top-2 right-2 text-xs text-text-quaternary">
            <div class="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        </Show>
      </div>
    </Show>
  );
}
