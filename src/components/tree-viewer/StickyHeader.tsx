/**
 * Sticky Header Component
 * 
 * Shows the current scope context (function/class names) at the top
 * when scrolling through code.
 */

import { For, Show, createMemo } from "solid-js";
import type { ScopeInfo } from "../../ipc/types";

interface StickyHeaderProps {
  scopes: ScopeInfo[];
  currentLine: number;
}

export function StickyHeader(props: StickyHeaderProps) {
  // Get scopes that contain the current line, sorted by depth
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
      <div class="sticky-headers fixed top-0 left-0 right-0 z-50 transition-all duration-200">
        <For each={activeScopes()}>
          {(scope, index) => (
            <div
              class="sticky-header-item flex items-center px-4 py-1.5 text-xs font-mono backdrop-blur-md border-b border-white/5 transition-all hover:bg-white/5 cursor-pointer group"
              style={{
                "padding-left": `${scope.depth * 16 + 24}px`, // Adjusted indentation
                "background-color": `rgba(30, 30, 30, ${0.85 + index() * 0.05})`,
                "border-left": `4px solid ${getScopeColor(scope.depth)}`,
              }}
              title={`Jump to line ${scope.start_line + 1}`}
            >
              <span class="mr-2 opacity-70 group-hover:opacity-100 transition-opacity" style={{ color: getScopeColor(scope.depth) }}>
                {getScopeIcon(scope.scope_type)}
              </span>
              <span class="text-gray-200 font-medium group-hover:text-white transition-colors">
                {scope.scope_name}
              </span>
              <span class="ml-auto text-gray-500 text-[10px] group-hover:text-gray-400">
                Ln {scope.start_line + 1}
              </span>
            </div>
          )}
        </For>
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
