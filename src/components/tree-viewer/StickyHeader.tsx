/**
 * Sticky Header Component
 * 
 * Shows nested scope context (function/class names) at the top
 * when scrolling through code. Uses absolute positioning to float
 * above the editor without affecting layout.
 */

import { For, Show, createMemo } from "solid-js";
import type { ScopeInfo } from "../../ipc/types";

interface StickyHeaderProps {
  scopes: ScopeInfo[];
  currentLine: number;
  onScopeClick?: (scope: ScopeInfo) => void;
}

export function StickyHeader(props: StickyHeaderProps) {
  // Get scopes that contain the current line, sorted by depth (outermost first)
  const activeScopes = createMemo(() => {
    return props.scopes
      .filter(scope => 
        props.currentLine >= scope.start_line && 
        props.currentLine <= scope.end_line
      )
      .sort((a, b) => a.depth - b.depth);
  });

  return (
    <Show when={activeScopes().length > 0}>
      {/* Absolute positioned container - floats above editor */}
      <div class="absolute top-0 left-0 right-0 z-40 pointer-events-auto">
        <div class="bg-bg-secondary/95 backdrop-blur-sm border-b border-border shadow-md">
          <For each={activeScopes()}>
            {(scope) => (
              <div
                class="sticky-header-item flex items-center h-5 text-xs font-mono border-b border-border/30 last:border-b-0 hover:bg-bg-hover cursor-pointer transition-colors"
                style={{
                  "padding-left": `${scope.depth * 12 + 56}px`,
                  "border-left": `3px solid ${getScopeColor(scope.depth)}`,
                }}
                onClick={() => props.onScopeClick?.(scope)}
                title={`Jump to line ${scope.start_line + 1}`}
              >
                <span 
                  class="mr-1.5 w-3 text-center text-[10px]" 
                  style={{ color: getScopeColor(scope.depth) }}
                >
                  {getScopeIcon(scope.scope_type)}
                </span>
                <span class="text-text-primary truncate text-[11px]">
                  {scope.scope_name}
                </span>
                <span class="ml-auto mr-2 text-text-tertiary text-[9px]">
                  {scope.start_line + 1}
                </span>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}

function getScopeColor(depth: number): string {
  const colors = [
    "#3b82f6", // blue
    "#8b5cf6", // purple
    "#ec4899", // pink
    "#f59e0b", // amber
    "#10b981", // green
  ];
  const index = Math.min(depth - 1, colors.length - 1);
  return colors[index] || "#6b7280";
}

function getScopeIcon(scopeType: string): string {
  const icons: Record<string, string> = {
    "function_declaration": "ƒ",
    "method_declaration": "ƒ",
    "class_declaration": "C",
    "if_statement": "?",
    "for_statement": "⟳",
    "while_statement": "⟳",
    "try_statement": "⚠",
    "impl_item": "⚙",
  };
  return icons[scopeType] || "•";
}
