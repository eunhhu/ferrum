/**
 * Hover Tooltip Component
 *
 * Displays hover information from LSP (type info, documentation, etc.)
 */

import { Show } from "solid-js";

interface HoverTooltipProps {
  content: string | null;
  visible: boolean;
  position: { x: number; y: number };
}

export function HoverTooltip(props: HoverTooltipProps) {
  return (
    <Show when={props.visible && props.content}>
      <div
        class="fixed z-40 bg-bg-secondary border border-border rounded shadow-lg overflow-hidden pointer-events-none"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
          "max-width": "600px",
          "max-height": "300px",
        }}
      >
        <div class="p-3 text-sm overflow-auto max-h-72">
          {/* Render markdown-like content */}
          <pre class="font-mono text-text-primary whitespace-pre-wrap break-words">
            {props.content}
          </pre>
        </div>
      </div>
    </Show>
  );
}
