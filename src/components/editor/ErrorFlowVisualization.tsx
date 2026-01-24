/**
 * Error Flow Visualization Component
 *
 * Visualizes error propagation through code:
 * - Shows where errors are thrown
 * - Shows where errors propagate through
 * - Shows where errors are caught
 * - Displays call stack traces
 */

import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";

interface ErrorFlowNode {
  id: string;
  type: "throw" | "propagate" | "catch" | "try";
  line: number;
  column: number;
  name: string;
  message?: string;
  parentId?: string;
}

interface ErrorFlowProps {
  filePath: string | null;
  content: string;
  enabled: boolean;
  lineHeight: number;
  visibleStartLine: number;
  visibleEndLine: number;
  onNodeClick?: (line: number) => void;
}

export function ErrorFlowVisualization(props: ErrorFlowProps) {
  const [errorNodes, setErrorNodes] = createSignal<ErrorFlowNode[]>([]);
  const [selectedNode, setSelectedNode] = createSignal<string | null>(null);
  const [hoveredNode, setHoveredNode] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Analyze error flow when content changes
  createEffect(() => {
    if (!(props.enabled && props.content)) {
      setErrorNodes([]);
      return;
    }

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      analyzeErrorFlow(props.content);
    }, 200);
  });

  const analyzeErrorFlow = (content: string) => {
    setLoading(true);

    try {
      const nodes: ErrorFlowNode[] = [];
      const lines = content.split("\n");

      // Simple regex-based analysis for error patterns
      // In production, this would use tree-sitter for accurate AST analysis

      // Track try-catch blocks
      const tryStack: { line: number; id: string }[] = [];
      let nodeId = 0;

      lines.forEach((line, lineIdx) => {
        const trimmed = line.trim();

        // Detect try blocks
        if (/\btry\s*\{/.test(trimmed) || trimmed === "try {" || trimmed === "try") {
          const id = `try-${nodeId++}`;
          tryStack.push({ line: lineIdx, id });
          nodes.push({
            id,
            type: "try",
            line: lineIdx,
            column: line.indexOf("try"),
            name: "try",
          });
        }

        // Detect catch blocks
        const catchMatch = trimmed.match(/\bcatch\s*\(([^)]*)\)/);
        if (catchMatch) {
          const tryBlock = tryStack.pop();
          const id = `catch-${nodeId++}`;
          nodes.push({
            id,
            type: "catch",
            line: lineIdx,
            column: line.indexOf("catch"),
            name: catchMatch[1] || "error",
            ...(tryBlock?.id ? { parentId: tryBlock.id } : {}),
          });
        }

        // Detect throw statements
        const throwMatch = trimmed.match(/\bthrow\s+(?:new\s+)?(\w+)?\s*\(?\s*['""]?([^'"")]*)?/);
        if (throwMatch) {
          const id = `throw-${nodeId++}`;
          const currentTry = tryStack[tryStack.length - 1];
          const messageVal = throwMatch[2]?.trim();
          nodes.push({
            id,
            type: "throw",
            line: lineIdx,
            column: line.indexOf("throw"),
            name: throwMatch[1] || "Error",
            ...(messageVal ? { message: messageVal } : {}),
            ...(currentTry?.id ? { parentId: currentTry.id } : {}),
          });
        }

        // Detect error-prone patterns (async/await without try-catch, .then without .catch)
        if (/await\s+/.test(trimmed) && tryStack.length === 0) {
          // Await outside try-catch - potential propagation point
          const id = `propagate-${nodeId++}`;
          nodes.push({
            id,
            type: "propagate",
            line: lineIdx,
            column: line.indexOf("await"),
            name: "await (unhandled)",
            message: "Async error may propagate",
          });
        }

        // Detect Promise.reject
        if (/Promise\.reject/.test(trimmed)) {
          const id = `throw-${nodeId++}`;
          nodes.push({
            id,
            type: "throw",
            line: lineIdx,
            column: line.indexOf("Promise.reject"),
            name: "Promise.reject",
          });
        }

        // Detect .catch() for promises
        if (/\.catch\s*\(/.test(trimmed)) {
          const id = `catch-${nodeId++}`;
          nodes.push({
            id,
            type: "catch",
            line: lineIdx,
            column: line.indexOf(".catch"),
            name: ".catch()",
          });
        }
      });

      setErrorNodes(nodes);
    } catch (e) {
      console.error("Error analyzing error flow:", e);
      setErrorNodes([]);
    } finally {
      setLoading(false);
    }
  };

  const getNodeColor = (type: ErrorFlowNode["type"]): string => {
    switch (type) {
      case "throw":
        return "bg-red-500";
      case "propagate":
        return "bg-yellow-500";
      case "catch":
        return "bg-green-500";
      case "try":
        return "bg-blue-500";
      default:
        return "bg-gray-500";
    }
  };

  const isNodeVisible = (node: ErrorFlowNode): boolean => {
    return node.line >= props.visibleStartLine && node.line <= props.visibleEndLine;
  };

  const getRelatedNodes = (nodeId: string): ErrorFlowNode[] => {
    const nodes = errorNodes();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return [];

    const related: ErrorFlowNode[] = [node];

    // Find related nodes by parentId
    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId);
      if (parent) related.push(parent);
    }

    // Find children
    const children = nodes.filter((n) => n.parentId === nodeId);
    related.push(...children);

    return related;
  };

  const isNodeHighlighted = (node: ErrorFlowNode): boolean => {
    const selected = selectedNode();
    const hovered = hoveredNode();
    const activeId = hovered || selected;
    if (!activeId) return false;

    const relatedNodes = getRelatedNodes(activeId);
    return relatedNodes.some((n) => n.id === node.id);
  };

  return (
    <Show when={props.enabled}>
      <div class="error-flow-visualization absolute left-0 top-0 pointer-events-none z-10">
        {/* Loading indicator */}
        <Show when={loading()}>
          <div class="absolute top-2 left-12 flex items-center gap-1.5 bg-bg-secondary/80 px-2 py-1 rounded text-xs text-text-tertiary">
            <div class="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
            Analyzing...
          </div>
        </Show>

        {/* Error flow markers in the gutter */}
        <For each={errorNodes().filter(isNodeVisible)}>
          {(node) => {
            const y = (node.line - props.visibleStartLine) * props.lineHeight;
            const isHighlighted = isNodeHighlighted(node);

            return (
              <div
                class={`absolute left-0 w-8 flex items-center justify-center cursor-pointer pointer-events-auto transition-all duration-150`}
                classList={{
                  "opacity-100": isHighlighted,
                  "opacity-60": !isHighlighted,
                }}
                style={{
                  top: `${y}px`,
                  height: `${props.lineHeight}px`,
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={() => {
                  setSelectedNode(node.id === selectedNode() ? null : node.id);
                  props.onNodeClick?.(node.line);
                }}
              >
                <span
                  class={`w-4 h-4 flex items-center justify-center rounded-full text-[10px] ${getNodeColor(node.type)} text-white`}
                  title={`${node.type}: ${node.name}${node.message ? ` - ${node.message}` : ""}`}
                >
                  {node.type === "throw"
                    ? "!"
                    : node.type === "catch"
                      ? "✓"
                      : node.type === "try"
                        ? "T"
                        : "?"}
                </span>
              </div>
            );
          }}
        </For>

        {/* Connection lines between related nodes */}
        <svg class="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          <For each={errorNodes().filter((n) => n.parentId && isNodeVisible(n))}>
            {(node) => {
              const parent = errorNodes().find((n) => n.id === node.parentId);
              if (!parent) return null;

              const y1 =
                (parent.line - props.visibleStartLine) * props.lineHeight + props.lineHeight / 2;
              const y2 =
                (node.line - props.visibleStartLine) * props.lineHeight + props.lineHeight / 2;
              const isHighlighted = isNodeHighlighted(node);

              return (
                <path
                  d={`M 16 ${y1} C 8 ${y1}, 8 ${y2}, 16 ${y2}`}
                  fill="none"
                  stroke={
                    node.type === "catch"
                      ? "#22c55e"
                      : node.type === "throw"
                        ? "#ef4444"
                        : "#eab308"
                  }
                  stroke-width={isHighlighted ? 2 : 1}
                  stroke-dasharray={node.type === "propagate" ? "4,2" : undefined}
                  class="transition-all duration-150"
                  classList={{
                    "opacity-60": isHighlighted,
                    "opacity-20": !isHighlighted,
                  }}
                />
              );
            }}
          </For>
        </svg>

        {/* Hover tooltip */}
        <Show when={hoveredNode()}>
          {(nodeId) => {
            const node = errorNodes().find((n) => n.id === nodeId());
            if (!node) return null;

            const y = (node.line - props.visibleStartLine) * props.lineHeight;

            return (
              <div
                class="absolute left-10 z-50 bg-bg-secondary border border-border rounded-lg shadow-xl px-3 py-2 text-xs pointer-events-none max-w-xs"
                style={{ top: `${y}px` }}
              >
                <div class="flex items-center gap-2 mb-1">
                  <span class={`w-2 h-2 rounded-full ${getNodeColor(node.type)}`} />
                  <span class="font-medium text-text-primary capitalize">{node.type}</span>
                  <span class="text-text-tertiary">Line {node.line + 1}</span>
                </div>
                <div class="text-text-secondary font-mono">{node.name}</div>
                <Show when={node.message}>
                  <div class="text-text-tertiary mt-1 truncate">"{node.message}"</div>
                </Show>
                <Show when={node.parentId}>
                  <div class="text-text-quaternary mt-1 text-[10px]">
                    Connected to: {node.parentId}
                  </div>
                </Show>
              </div>
            );
          }}
        </Show>

        {/* Legend */}
        <Show when={errorNodes().length > 0}>
          <div class="absolute bottom-2 left-2 flex gap-3 bg-bg-secondary/80 px-2 py-1 rounded text-[10px] pointer-events-auto">
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-red-500" />
              <span class="text-text-tertiary">Throw</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-yellow-500" />
              <span class="text-text-tertiary">Propagate</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-green-500" />
              <span class="text-text-tertiary">Catch</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-blue-500" />
              <span class="text-text-tertiary">Try</span>
            </div>
          </div>
        </Show>

        {/* Summary */}
        <Show when={errorNodes().length > 0}>
          <div class="absolute top-2 right-2 bg-bg-secondary/80 px-2 py-1 rounded text-[10px] text-text-tertiary pointer-events-auto">
            {errorNodes().filter((n) => n.type === "throw").length} throws,{" "}
            {errorNodes().filter((n) => n.type === "catch").length} catches
          </div>
        </Show>
      </div>
    </Show>
  );
}
