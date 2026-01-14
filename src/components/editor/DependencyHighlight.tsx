/**
 * Dependency Highlight Component
 *
 * Highlights import/export relationships and shows dependency connections
 * between symbols in the current file.
 */

import { createSignal, createEffect, For, Show } from "solid-js";
import { lspDocumentSymbols, type LspSymbolInfo } from "../../ipc/commands";

interface DependencyLink {
  id: string;
  fromSymbol: string;
  toSymbol: string;
  fromLine: number;
  toLine: number;
  type: "import" | "export" | "call" | "reference";
}

interface DependencyHighlightProps {
  filePath: string | null;
  enabled: boolean;
  lineHeight: number;
  visibleStartLine: number;
  visibleEndLine: number;
  onSymbolClick?: (symbol: string, line: number) => void;
}

export function DependencyHighlight(props: DependencyHighlightProps) {
  const [dependencies, setDependencies] = createSignal<DependencyLink[]>([]);
  const [hoveredSymbol, setHoveredSymbol] = createSignal<string | null>(null);
  const [symbols, setSymbols] = createSignal<LspSymbolInfo[]>([]);

  // Load symbols and analyze dependencies
  createEffect(() => {
    if (props.enabled && props.filePath) {
      loadDependencies();
    }
  });

  const loadDependencies = async () => {
    if (!props.filePath) return;

    try {
      const syms = await lspDocumentSymbols(props.filePath);
      setSymbols(syms);

      // Analyze dependencies between symbols
      const deps = analyzeDependencies(syms);
      setDependencies(deps);
    } catch (e) {
      console.error("Failed to load dependencies:", e);
      setDependencies([]);
    }
  };

  const analyzeDependencies = (symbols: LspSymbolInfo[]): DependencyLink[] => {
    const deps: DependencyLink[] = [];
    const flatSymbols = flattenSymbols(symbols);

    // Create mock dependencies based on symbol proximity
    // In a real implementation, this would use LSP references
    for (let i = 0; i < flatSymbols.length; i++) {
      for (let j = i + 1; j < flatSymbols.length; j++) {
        const from = flatSymbols[i];
        const to = flatSymbols[j];

        // Check if symbols might be related (same name pattern, proximity, etc.)
        if (from && to && mightBeRelated(from, to)) {
          deps.push({
            id: `${from.name}-${to.name}`,
            fromSymbol: from.name,
            toSymbol: to.name,
            fromLine: from.range.start.line,
            toLine: to.range.start.line,
            type: determineRelationType(from, to),
          });
        }
      }
    }

    return deps;
  };

  const flattenSymbols = (symbols: LspSymbolInfo[]): LspSymbolInfo[] => {
    const result: LspSymbolInfo[] = [];
    const traverse = (syms: LspSymbolInfo[]) => {
      for (const sym of syms) {
        result.push(sym);
        if (sym.children) {
          traverse(sym.children);
        }
      }
    };
    traverse(symbols);
    return result;
  };

  const mightBeRelated = (a: LspSymbolInfo, b: LspSymbolInfo): boolean => {
    // Simple heuristic: methods in same class, or functions calling each other
    const aIsMethod = a.kind === 6;
    const bIsMethod = b.kind === 6;

    if (aIsMethod && bIsMethod) {
      // Both are methods - might be in same class
      return Math.abs(a.range.start.line - b.range.start.line) < 20;
    }

    // Function and its caller
    if ((a.kind === 12 || b.kind === 12) && Math.abs(a.range.start.line - b.range.start.line) < 50) {
      return Math.random() > 0.7; // Random for demo
    }

    return false;
  };

  const determineRelationType = (from: LspSymbolInfo, to: LspSymbolInfo): DependencyLink["type"] => {
    if (from.kind === 6 && to.kind === 6) return "reference";
    if (from.kind === 12 || to.kind === 12) return "call";
    return "reference";
  };

  const getLinkColor = (type: DependencyLink["type"]): string => {
    switch (type) {
      case "import":
        return "stroke-blue-400";
      case "export":
        return "stroke-green-400";
      case "call":
        return "stroke-purple-400";
      case "reference":
        return "stroke-yellow-400";
      default:
        return "stroke-gray-400";
    }
  };

  const isLinkVisible = (link: DependencyLink): boolean => {
    return (
      (link.fromLine >= props.visibleStartLine && link.fromLine <= props.visibleEndLine) ||
      (link.toLine >= props.visibleStartLine && link.toLine <= props.visibleEndLine)
    );
  };

  const isLinkHighlighted = (link: DependencyLink): boolean => {
    const hovered = hoveredSymbol();
    if (!hovered) return false;
    return link.fromSymbol === hovered || link.toSymbol === hovered;
  };

  return (
    <Show when={props.enabled}>
      <div class="dependency-highlight absolute inset-0 pointer-events-none z-5">
        {/* SVG for connection lines */}
        <svg class="absolute inset-0 w-full h-full overflow-visible">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="6"
              markerHeight="4"
              refX="5"
              refY="2"
              orient="auto"
            >
              <polygon points="0 0, 6 2, 0 4" fill="currentColor" />
            </marker>
          </defs>

          <For each={dependencies().filter(isLinkVisible)}>
            {(link) => {
              const y1 = (link.fromLine - props.visibleStartLine) * props.lineHeight + props.lineHeight / 2;
              const y2 = (link.toLine - props.visibleStartLine) * props.lineHeight + props.lineHeight / 2;
              const x1 = 40;
              const x2 = 40;
              const cx = 20;

              const isHighlighted = isLinkHighlighted(link);

              return (
                <path
                  d={`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  class={`transition-opacity duration-150 ${getLinkColor(link.type)}`}
                  classList={{
                    "opacity-60": isHighlighted,
                    "opacity-20": !isHighlighted,
                  }}
                  stroke-width={isHighlighted ? 2 : 1}
                  marker-end="url(#arrowhead)"
                />
              );
            }}
          </For>
        </svg>

        {/* Symbol markers */}
        <For each={flattenSymbols(symbols()).filter(s => 
          s.range.start.line >= props.visibleStartLine && 
          s.range.start.line <= props.visibleEndLine
        )}>
          {(symbol) => {
            const y = (symbol.range.start.line - props.visibleStartLine) * props.lineHeight;
            const isHovered = hoveredSymbol() === symbol.name;

            return (
              <div
                class="absolute left-1 w-2 h-2 rounded-full cursor-pointer pointer-events-auto transition-all duration-150"
                classList={{
                  "bg-accent scale-125": isHovered,
                  "bg-text-tertiary": !isHovered,
                }}
                style={{
                  top: `${y + props.lineHeight / 2 - 4}px`,
                }}
                onMouseEnter={() => setHoveredSymbol(symbol.name)}
                onMouseLeave={() => setHoveredSymbol(null)}
                onClick={() => props.onSymbolClick?.(symbol.name, symbol.range.start.line)}
                title={symbol.name}
              />
            );
          }}
        </For>
      </div>
    </Show>
  );
}
