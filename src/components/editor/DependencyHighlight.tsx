/**
 * Dependency Highlight Component
 *
 * Highlights import/export relationships and shows dependency connections
 * between symbols in the current file using tree-sitter based analysis.
 */

import { createSignal, createEffect, For, Show, onCleanup } from "solid-js";
import { analyzeDependencies, type DependencyLink } from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";

interface DependencyHighlightProps {
  bufferId: string | null;
  enabled: boolean;
  lineHeight: number;
  visibleStartLine: number;
  visibleEndLine: number;
  onSymbolClick?: (symbol: string, line: number) => void;
}

// Cache for dependency analysis results
const dependencyCache = new Map<
  string,
  { deps: DependencyLink[]; timestamp: number }
>();
const CACHE_TTL = 10000; // 10 seconds

export function DependencyHighlight(props: DependencyHighlightProps) {
  const [dependencies, setDependencies] = createSignal<DependencyLink[]>([]);
  const [hoveredSymbol, setHoveredSymbol] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Cleanup on unmount
  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Load dependencies when enabled and buffer changes
  createEffect(() => {
    if (!props.enabled || !props.bufferId) {
      setDependencies([]);
      return;
    }

    // Debounce to avoid excessive calls
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadDependencies(props.bufferId!);
    }, 150);
  });

  const loadDependencies = async (bufferId: string) => {
    // Check cache first
    const cached = dependencyCache.get(bufferId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setDependencies(cached.deps);
      setError(null);
      return;
    }

    // Skip if not in Tauri environment
    if (!isTauriEnvironment()) {
      setError("Dependency analysis not available");
      setDependencies([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const deps = await analyzeDependencies(bufferId);
      setDependencies(deps);

      // Update cache
      dependencyCache.set(bufferId, { deps, timestamp: Date.now() });
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "Failed to analyze dependencies";
      console.error("Failed to analyze dependencies:", e);
      setError(errorMsg);
      setDependencies([]);
    } finally {
      setLoading(false);
    }
  };

  const getLinkColor = (type: DependencyLink["type"]): string => {
    switch (type) {
      case "import":
        return "stroke-blue-400";
      case "call":
        return "stroke-purple-400";
      case "reference":
        return "stroke-yellow-400";
      case "extends":
        return "stroke-green-400";
      case "implements":
        return "stroke-cyan-400";
      default:
        return "stroke-gray-400";
    }
  };

  const getLinkDotColor = (type: DependencyLink["type"]): string => {
    switch (type) {
      case "import":
        return "bg-blue-400";
      case "call":
        return "bg-purple-400";
      case "reference":
        return "bg-yellow-400";
      case "extends":
        return "bg-green-400";
      case "implements":
        return "bg-cyan-400";
      default:
        return "bg-gray-400";
    }
  };

  const isLinkVisible = (link: DependencyLink): boolean => {
    return (
      (link.from_line >= props.visibleStartLine &&
        link.from_line <= props.visibleEndLine) ||
      (link.to_line >= props.visibleStartLine &&
        link.to_line <= props.visibleEndLine)
    );
  };

  const isLinkHighlighted = (link: DependencyLink): boolean => {
    const hovered = hoveredSymbol();
    if (!hovered) return false;
    return link.from_symbol === hovered || link.to_symbol === hovered;
  };

  // Get unique symbols for rendering markers
  const getVisibleSymbols = () => {
    const deps = dependencies();
    const symbolMap = new Map<
      string,
      { name: string; line: number; type: DependencyLink["type"] }
    >();

    for (const dep of deps) {
      // Add source symbol
      if (
        dep.from_line >= props.visibleStartLine &&
        dep.from_line <= props.visibleEndLine
      ) {
        const key = `${dep.from_symbol}-${dep.from_line}`;
        if (!symbolMap.has(key)) {
          symbolMap.set(key, {
            name: dep.from_symbol,
            line: dep.from_line,
            type: dep.type,
          });
        }
      }
      // Add target symbol
      if (
        dep.to_line >= props.visibleStartLine &&
        dep.to_line <= props.visibleEndLine
      ) {
        const key = `${dep.to_symbol}-${dep.to_line}`;
        if (!symbolMap.has(key)) {
          symbolMap.set(key, {
            name: dep.to_symbol,
            line: dep.to_line,
            type: dep.type,
          });
        }
      }
    }

    return Array.from(symbolMap.values());
  };

  return (
    <Show when={props.enabled}>
      <div class="dependency-highlight absolute inset-0 pointer-events-none z-5">
        {/* Loading indicator */}
        <Show when={loading()}>
          <div class="absolute top-2 left-2 flex items-center gap-1.5 bg-bg-secondary/80 px-2 py-1 rounded text-xs text-text-tertiary">
            <div class="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
            Analyzing...
          </div>
        </Show>

        {/* Error indicator */}
        <Show when={error() && !loading()}>
          <div class="absolute top-2 left-2 bg-red-900/50 px-2 py-1 rounded text-xs text-red-300">
            {error()}
          </div>
        </Show>

        {/* SVG for connection lines */}
        <svg class="absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <marker
              id="arrowhead-call"
              markerWidth="6"
              markerHeight="4"
              refX="5"
              refY="2"
              orient="auto"
            >
              <polygon points="0 0, 6 2, 0 4" class="fill-purple-400" />
            </marker>
            <marker
              id="arrowhead-reference"
              markerWidth="6"
              markerHeight="4"
              refX="5"
              refY="2"
              orient="auto"
            >
              <polygon points="0 0, 6 2, 0 4" class="fill-yellow-400" />
            </marker>
            <marker
              id="arrowhead-import"
              markerWidth="6"
              markerHeight="4"
              refX="5"
              refY="2"
              orient="auto"
            >
              <polygon points="0 0, 6 2, 0 4" class="fill-blue-400" />
            </marker>
          </defs>

          <For each={dependencies().filter(isLinkVisible)}>
            {(link) => {
              const y1 =
                (link.from_line - props.visibleStartLine) * props.lineHeight +
                props.lineHeight / 2;
              const y2 =
                (link.to_line - props.visibleStartLine) * props.lineHeight +
                props.lineHeight / 2;
              const x1 = 40;
              const x2 = 40;

              // Calculate control point for bezier curve
              const distance = Math.abs(y2 - y1);
              const cx = Math.max(5, 30 - Math.min(distance / 20, 20));

              const isHighlighted = isLinkHighlighted(link);

              // Skip if same line (self-reference)
              if (link.from_line === link.to_line) return null;

              return (
                <path
                  d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  class={`transition-all duration-150 ${getLinkColor(link.type)}`}
                  classList={{
                    "opacity-70": isHighlighted,
                    "opacity-20": !isHighlighted && hoveredSymbol() !== null,
                    "opacity-30": !isHighlighted && hoveredSymbol() === null,
                  }}
                  stroke-width={isHighlighted ? 2 : 1}
                  marker-end={`url(#arrowhead-${link.type})`}
                />
              );
            }}
          </For>
        </svg>

        {/* Symbol markers */}
        <For each={getVisibleSymbols()}>
          {(symbol) => {
            const y = (symbol.line - props.visibleStartLine) * props.lineHeight;
            const isHovered = hoveredSymbol() === symbol.name;

            return (
              <div
                class={`absolute left-1 w-2 h-2 rounded-full cursor-pointer pointer-events-auto transition-all duration-150 ${getLinkDotColor(symbol.type)}`}
                classList={{
                  "scale-150 ring-2 ring-white/30": isHovered,
                  "opacity-60": !isHovered,
                }}
                style={{
                  top: `${y + props.lineHeight / 2 - 4}px`,
                }}
                onMouseEnter={() => setHoveredSymbol(symbol.name)}
                onMouseLeave={() => setHoveredSymbol(null)}
                onClick={() => props.onSymbolClick?.(symbol.name, symbol.line)}
                title={`${symbol.name} (${symbol.type})`}
              />
            );
          }}
        </For>

        {/* Hover tooltip */}
        <Show when={hoveredSymbol()}>
          {(symbolName) => {
            const relatedDeps = dependencies().filter(
              (d) =>
                d.from_symbol === symbolName() || d.to_symbol === symbolName()
            );
            if (relatedDeps.length === 0) return null;

            return (
              <div class="absolute left-12 top-2 z-50 bg-bg-secondary border border-border rounded-lg shadow-xl px-3 py-2 text-xs max-w-xs">
                <div class="font-medium text-text-primary mb-1">
                  {symbolName()}
                </div>
                <div class="text-text-tertiary space-y-0.5">
                  <For each={relatedDeps.slice(0, 5)}>
                    {(dep) => (
                      <div class="flex items-center gap-1.5">
                        <span
                          class={`w-1.5 h-1.5 rounded-full ${getLinkDotColor(dep.type)}`}
                        />
                        <span>
                          {dep.from_symbol === symbolName()
                            ? `→ ${dep.to_symbol}`
                            : `← ${dep.from_symbol}`}
                        </span>
                        <span class="text-text-quaternary">({dep.type})</span>
                      </div>
                    )}
                  </For>
                  <Show when={relatedDeps.length > 5}>
                    <div class="text-text-quaternary">
                      +{relatedDeps.length - 5} more
                    </div>
                  </Show>
                </div>
              </div>
            );
          }}
        </Show>

        {/* Empty state */}
        <Show when={!loading() && dependencies().length === 0 && !error()}>
          <div class="absolute top-2 left-2 bg-bg-secondary/60 px-2 py-1 rounded text-xs text-text-quaternary">
            No dependencies
          </div>
        </Show>

        {/* Legend */}
        <Show when={dependencies().length > 0}>
          <div class="absolute bottom-2 left-2 flex gap-3 bg-bg-secondary/80 px-2 py-1 rounded text-xs">
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-purple-400" />
              <span class="text-text-tertiary">Call</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-yellow-400" />
              <span class="text-text-tertiary">Ref</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-blue-400" />
              <span class="text-text-tertiary">Import</span>
            </div>
          </div>
        </Show>
      </div>
    </Show>
  );
}

// Export function to invalidate cache
export function invalidateDependencyCache(bufferId: string): void {
  dependencyCache.delete(bufferId);
}

export function clearDependencyCache(): void {
  dependencyCache.clear();
}
