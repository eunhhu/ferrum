/**
 * Visual Code View Component
 *
 * Node-based visual representation of code structure.
 * Shows functions, classes, and their relationships as connected nodes.
 */

import { createSignal, createEffect, For, Show, onMount, onCleanup } from "solid-js";
import { lspDocumentSymbols, type LspSymbolInfo } from "../../ipc/commands";

interface VisualNode {
  id: string;
  type: "function" | "class" | "method" | "variable" | "module" | "interface";
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: string[];
  parent: string | undefined;
  startLine: number;
  endLine: number;
}

interface Connection {
  from: string;
  to: string;
  type: "contains" | "calls" | "imports" | "extends";
}

interface VisualCodeViewProps {
  filePath: string | null;
  onNodeClick?: (node: VisualNode) => void;
  onNodeDoubleClick?: (node: VisualNode) => void;
}

export function VisualCodeView(props: VisualCodeViewProps) {
  const [nodes, setNodes] = createSignal<VisualNode[]>([]);
  const [connections, setConnections] = createSignal<Connection[]>([]);
  const [selectedNode, setSelectedNode] = createSignal<string | null>(null);
  const [hoveredNode, setHoveredNode] = createSignal<string | null>(null);
  const [pan, setPan] = createSignal({ x: 50, y: 50 });
  const [zoom, setZoom] = createSignal(1);
  const [isDragging, setIsDragging] = createSignal(false);
  const [dragStart, setDragStart] = createSignal({ x: 0, y: 0 });

  let containerRef: HTMLDivElement | undefined;

  // Load symbols and convert to visual nodes
  createEffect(() => {
    if (props.filePath) {
      loadSymbols();
    }
  });

  const loadSymbols = async () => {
    if (!props.filePath) return;

    try {
      const symbols = await lspDocumentSymbols(props.filePath);
      const { nodes: newNodes, connections: newConnections } = symbolsToNodes(symbols);
      setNodes(newNodes);
      setConnections(newConnections);
    } catch (e) {
      console.error("Failed to load symbols for visual view:", e);
      setNodes([]);
      setConnections([]);
    }
  };

  const symbolsToNodes = (
    symbols: LspSymbolInfo[],
    parentId?: string,
    startX = 0,
    startY = 0
  ): { nodes: VisualNode[]; connections: Connection[] } => {
    const nodes: VisualNode[] = [];
    const connections: Connection[] = [];

    let currentY = startY;
    const nodeWidth = 200;
    const nodeHeight = 60;
    const horizontalGap = 50;
    const verticalGap = 30;

    symbols.forEach((symbol, index) => {
      const nodeId = `${parentId ? parentId + "-" : ""}${symbol.name}-${index}`;
      const nodeType = symbolKindToNodeType(symbol.kind);

      const node: VisualNode = {
        id: nodeId,
        type: nodeType,
        name: symbol.name,
        x: startX,
        y: currentY,
        width: nodeWidth,
        height: nodeHeight,
        children: [],
        parent: parentId,
        startLine: symbol.range.start.line,
        endLine: symbol.range.end.line,
      };

      nodes.push(node);

      // Add connection to parent
      if (parentId) {
        connections.push({
          from: parentId,
          to: nodeId,
          type: "contains",
        });
      }

      // Process children
      if (symbol.children && symbol.children.length > 0) {
        const childResult = symbolsToNodes(
          symbol.children,
          nodeId,
          startX + nodeWidth + horizontalGap,
          currentY
        );

        nodes.push(...childResult.nodes);
        connections.push(...childResult.connections);

        // Update node's children list
        node.children = childResult.nodes
          .filter((n) => n.parent === nodeId)
          .map((n) => n.id);

        // Adjust Y based on children height
        const childrenHeight =
          childResult.nodes.filter((n) => n.parent === nodeId).length *
          (nodeHeight + verticalGap);
        currentY += Math.max(nodeHeight + verticalGap, childrenHeight);
      } else {
        currentY += nodeHeight + verticalGap;
      }
    });

    return { nodes, connections };
  };

  const symbolKindToNodeType = (kind: number): VisualNode["type"] => {
    switch (kind) {
      case 5: // Class
        return "class";
      case 6: // Method
        return "method";
      case 12: // Function
        return "function";
      case 11: // Interface
        return "interface";
      case 2: // Module
        return "module";
      default:
        return "variable";
    }
  };

  const getNodeColor = (type: VisualNode["type"]): string => {
    switch (type) {
      case "class":
        return "bg-blue-500/20 border-blue-500";
      case "function":
        return "bg-green-500/20 border-green-500";
      case "method":
        return "bg-purple-500/20 border-purple-500";
      case "interface":
        return "bg-yellow-500/20 border-yellow-500";
      case "module":
        return "bg-orange-500/20 border-orange-500";
      default:
        return "bg-gray-500/20 border-gray-500";
    }
  };

  const getNodeIcon = (type: VisualNode["type"]): string => {
    switch (type) {
      case "class":
        return "🔷";
      case "function":
        return "ƒ";
      case "method":
        return "⚡";
      case "interface":
        return "🔶";
      case "module":
        return "📦";
      default:
        return "📌";
    }
  };

  // Pan and zoom handlers
  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom((z) => Math.max(0.25, Math.min(2, z * delta)));
    } else {
      // Pan
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    }
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan().x, y: e.clientY - pan().y });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging()) {
      setPan({
        x: e.clientX - dragStart().x,
        y: e.clientY - dragStart().y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  onMount(() => {
    containerRef?.addEventListener("wheel", handleWheel, { passive: false });
  });

  onCleanup(() => {
    containerRef?.removeEventListener("wheel", handleWheel);
  });

  // Render connection lines
  const renderConnections = () => {
    return connections().map((conn) => {
      const fromNode = nodes().find((n) => n.id === conn.from);
      const toNode = nodes().find((n) => n.id === conn.to);

      if (!fromNode || !toNode) return null;

      const x1 = fromNode.x + fromNode.width;
      const y1 = fromNode.y + fromNode.height / 2;
      const x2 = toNode.x;
      const y2 = toNode.y + toNode.height / 2;

      // Bezier curve control points
      const cx1 = x1 + (x2 - x1) / 3;
      const cx2 = x2 - (x2 - x1) / 3;

      return (
        <path
          d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
          fill="none"
          stroke="rgba(100, 100, 100, 0.4)"
          stroke-width="2"
          class="transition-all duration-150"
          classList={{
            "stroke-accent": hoveredNode() === conn.from || hoveredNode() === conn.to,
          }}
        />
      );
    });
  };

  return (
    <div
      ref={containerRef}
      class="visual-code-view w-full h-full bg-bg-tertiary overflow-hidden cursor-grab"
      classList={{ "cursor-grabbing": isDragging() }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Toolbar */}
      <div class="absolute top-4 left-4 z-10 flex items-center gap-2 bg-bg-secondary rounded-lg p-2 border border-border shadow-lg">
        <button
          class="px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          onClick={() => setZoom((z) => Math.min(2, z * 1.2))}
        >
          +
        </button>
        <span class="text-xs text-text-tertiary min-w-12 text-center">
          {Math.round(zoom() * 100)}%
        </span>
        <button
          class="px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          onClick={() => setZoom((z) => Math.max(0.25, z * 0.8))}
        >
          −
        </button>
        <div class="w-px h-4 bg-border mx-1" />
        <button
          class="px-2 py-1 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          onClick={() => {
            setPan({ x: 50, y: 50 });
            setZoom(1);
          }}
        >
          Reset
        </button>
      </div>

      {/* Canvas */}
      <div
        class="absolute inset-0"
        style={{
          transform: `translate(${pan().x}px, ${pan().y}px) scale(${zoom()})`,
          "transform-origin": "0 0",
        }}
      >
        {/* SVG for connections */}
        <svg class="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          {renderConnections()}
        </svg>

        {/* Nodes */}
        <For each={nodes()}>
          {(node) => (
            <div
              class={`absolute rounded-lg border-2 transition-all duration-150 cursor-pointer ${getNodeColor(node.type)}`}
              classList={{
                "ring-2 ring-accent ring-offset-2 ring-offset-bg-tertiary":
                  selectedNode() === node.id,
                "scale-105 shadow-lg": hoveredNode() === node.id,
              }}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                width: `${node.width}px`,
                height: `${node.height}px`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedNode(node.id);
                props.onNodeClick?.(node);
              }}
              onDblClick={(e) => {
                e.stopPropagation();
                props.onNodeDoubleClick?.(node);
              }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode(null)}
            >
              <div class="flex items-center gap-2 px-3 py-2 h-full">
                <span class="text-lg">{getNodeIcon(node.type)}</span>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-text-primary truncate">
                    {node.name}
                  </div>
                  <div class="text-xs text-text-tertiary">
                    Lines {node.startLine + 1}-{node.endLine + 1}
                  </div>
                </div>
              </div>
            </div>
          )}
        </For>
      </div>

      {/* Empty state */}
      <Show when={nodes().length === 0}>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-center text-text-tertiary">
            <div class="text-4xl mb-4">◇</div>
            <div class="text-sm">No symbols found</div>
            <div class="text-xs mt-1">Open a file with code to see its visual structure</div>
          </div>
        </div>
      </Show>
    </div>
  );
}
