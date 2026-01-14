/**
 * Structural Minimap Component
 *
 * Shows a structural overview of the code with semantic blocks
 * instead of just a scaled-down version of the text.
 */

import { createSignal, createEffect, For, Show } from "solid-js";
import { lspDocumentSymbols, type LspSymbolInfo } from "../../ipc/commands";

interface MinimapBlock {
  id: string;
  type: "function" | "class" | "method" | "variable" | "import" | "other";
  name: string;
  startLine: number;
  endLine: number;
  depth: number;
  children: MinimapBlock[];
}

interface StructuralMinimapProps {
  filePath: string | null;
  totalLines: number;
  visibleStartLine: number;
  visibleEndLine: number;
  currentLine: number;
  onLineClick?: (line: number) => void;
}

export function StructuralMinimap(props: StructuralMinimapProps) {
  const [blocks, setBlocks] = createSignal<MinimapBlock[]>([]);
  const [hoveredBlock, setHoveredBlock] = createSignal<string | null>(null);

  // Load symbols and convert to blocks
  createEffect(() => {
    if (props.filePath) {
      loadSymbols();
    }
  });

  const loadSymbols = async () => {
    if (!props.filePath) return;

    try {
      const symbols = await lspDocumentSymbols(props.filePath);
      const newBlocks = symbolsToBlocks(symbols, 0);
      setBlocks(newBlocks);
    } catch (e) {
      console.error("Failed to load symbols for minimap:", e);
      setBlocks([]);
    }
  };

  const symbolsToBlocks = (symbols: LspSymbolInfo[], depth: number): MinimapBlock[] => {
    return symbols.map((symbol, index) => ({
      id: `${depth}-${index}-${symbol.name}`,
      type: symbolKindToType(symbol.kind),
      name: symbol.name,
      startLine: symbol.range.start.line,
      endLine: symbol.range.end.line,
      depth,
      children: symbol.children ? symbolsToBlocks(symbol.children, depth + 1) : [],
    }));
  };

  const symbolKindToType = (kind: number): MinimapBlock["type"] => {
    switch (kind) {
      case 5:
        return "class";
      case 6:
        return "method";
      case 12:
        return "function";
      case 13:
        return "variable";
      default:
        return "other";
    }
  };

  const getBlockColor = (type: MinimapBlock["type"]): string => {
    switch (type) {
      case "class":
        return "bg-blue-500";
      case "function":
        return "bg-green-500";
      case "method":
        return "bg-purple-500";
      case "variable":
        return "bg-yellow-500";
      case "import":
        return "bg-orange-500";
      default:
        return "bg-gray-500";
    }
  };

  const lineToY = (line: number): number => {
    return (line / Math.max(props.totalLines, 1)) * 100;
  };

  const lineToHeight = (startLine: number, endLine: number): number => {
    const lines = endLine - startLine + 1;
    return Math.max((lines / Math.max(props.totalLines, 1)) * 100, 0.5);
  };

  const renderBlock = (block: MinimapBlock) => {
    const y = lineToY(block.startLine);
    const height = lineToHeight(block.startLine, block.endLine);
    const isHovered = hoveredBlock() === block.id;
    const isCurrentLine =
      props.currentLine >= block.startLine && props.currentLine <= block.endLine;

    return (
      <>
        <div
          class={`absolute cursor-pointer transition-all duration-100 ${getBlockColor(block.type)}`}
          classList={{
            "opacity-80": isHovered || isCurrentLine,
            "opacity-40": !isHovered && !isCurrentLine,
          }}
          style={{
            top: `${y}%`,
            height: `${height}%`,
            left: `${block.depth * 4}px`,
            right: "2px",
            "min-height": "2px",
            "border-radius": "1px",
          }}
          onMouseEnter={() => setHoveredBlock(block.id)}
          onMouseLeave={() => setHoveredBlock(null)}
          onClick={() => props.onLineClick?.(block.startLine)}
          title={`${block.type}: ${block.name} (${block.startLine + 1}-${block.endLine + 1})`}
        />
        <For each={block.children}>{(child) => renderBlock(child)}</For>
      </>
    );
  };

  // Viewport indicator
  const viewportY = lineToY(props.visibleStartLine);
  const viewportHeight = lineToHeight(props.visibleStartLine, props.visibleEndLine);

  return (
    <div class="structural-minimap relative w-20 h-full bg-bg-tertiary border-l border-border">
      {/* Blocks */}
      <div class="absolute inset-0 overflow-hidden">
        <For each={blocks()}>{(block) => renderBlock(block)}</For>
      </div>

      {/* Viewport indicator */}
      <div
        class="absolute left-0 right-0 bg-white/10 border border-white/20 pointer-events-none"
        style={{
          top: `${viewportY}%`,
          height: `${Math.max(viewportHeight, 2)}%`,
        }}
      />

      {/* Current line indicator */}
      <div
        class="absolute left-0 right-0 h-0.5 bg-accent pointer-events-none"
        style={{
          top: `${lineToY(props.currentLine)}%`,
        }}
      />

      {/* Hover tooltip */}
      <Show when={hoveredBlock()}>
        {(blockId) => {
          const block = findBlock(blocks(), blockId());
          return (
            <Show when={block}>
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 bg-bg-secondary border border-border rounded px-2 py-1 text-xs whitespace-nowrap shadow-lg">
                <span class={`inline-block w-2 h-2 rounded-full mr-1.5 ${getBlockColor(block!.type)}`} />
                <span class="text-text-primary">{block!.name}</span>
                <span class="text-text-tertiary ml-2">
                  L{block!.startLine + 1}-{block!.endLine + 1}
                </span>
              </div>
            </Show>
          );
        }}
      </Show>

      {/* Empty state */}
      <Show when={blocks().length === 0}>
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="text-text-tertiary text-xs text-center px-2">No structure</div>
        </div>
      </Show>
    </div>
  );
}

function findBlock(blocks: MinimapBlock[], id: string): MinimapBlock | null {
  for (const block of blocks) {
    if (block.id === id) return block;
    const found = findBlock(block.children, id);
    if (found) return found;
  }
  return null;
}
