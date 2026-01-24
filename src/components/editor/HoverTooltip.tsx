/**
 * Hover Tooltip Component
 *
 * Displays hover information from LSP (type info, documentation, etc.)
 * Supports markdown-like content with code block rendering.
 */

import { createMemo, For, Show } from "solid-js";

interface HoverTooltipProps {
  content: string | null;
  visible: boolean;
  position: { x: number; y: number };
  language?: string;
}

// Parse content into sections (code blocks vs text)
interface ContentSection {
  type: "code" | "text";
  content: string;
  language?: string;
}

function parseContent(content: string): ContentSection[] {
  const sections: ContentSection[] = [];
  const codeBlockPattern = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = codeBlockPattern.exec(content);

  while (match !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) {
        sections.push({ type: "text", content: text });
      }
    }

    // Add code block
    const codeSection: ContentSection = {
      type: "code",
      content: match[2]?.trim() ?? "",
    };
    if (match[1]) {
      codeSection.language = match[1];
    }
    sections.push(codeSection);

    lastIndex = match.index + match[0].length;
    match = codeBlockPattern.exec(content);
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) {
      sections.push({ type: "text", content: text });
    }
  }

  // If no sections found, treat entire content as code
  if (sections.length === 0) {
    sections.push({ type: "code", content: content.trim() });
  }

  return sections;
}

export function HoverTooltip(props: HoverTooltipProps) {
  const sections = createMemo(() => {
    if (!props.content) return [];
    return parseContent(props.content);
  });

  return (
    <Show when={props.visible && props.content}>
      <div
        class="fixed z-40 bg-bg-secondary border border-border rounded-lg shadow-xl overflow-hidden pointer-events-none"
        style={{
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
          "max-width": "600px",
          "max-height": "400px",
        }}
      >
        <div class="overflow-auto max-h-96">
          <For each={sections()}>
            {(section) => (
              <Show
                when={section.type === "code"}
                fallback={
                  <div class="px-3 py-2 text-sm text-text-secondary border-b border-border/50 last:border-0">
                    {section.content}
                  </div>
                }
              >
                <div class="bg-bg-tertiary border-b border-border/50 last:border-0">
                  <Show when={section.language}>
                    <div class="px-2 py-0.5 text-[10px] text-text-tertiary uppercase tracking-wider border-b border-border/30">
                      {section.language}
                    </div>
                  </Show>
                  <pre class="px-3 py-2 text-sm font-mono text-text-primary whitespace-pre-wrap break-words overflow-x-auto">
                    <code class="hl-type">{section.content}</code>
                  </pre>
                </div>
              </Show>
            )}
          </For>
        </div>
      </div>
    </Show>
  );
}
