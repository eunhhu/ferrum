/**
 * Inline Blame Component
 *
 * Shows git blame information inline at the end of each line.
 * Displays author, time, and commit message on hover.
 */

import { createSignal, createEffect, Show, For } from "solid-js";
import { gitLog } from "../../ipc/commands";

interface BlameInfo {
  line: number;
  commitId: string;
  shortId: string;
  author: string;
  time: number;
  message: string;
}

interface InlineBlameProps {
  repoPath: string | null;
  filePath: string | null;
  visibleLines: { start: number; end: number };
  lineHeight: number;
  enabled: boolean;
}

export function InlineBlame(props: InlineBlameProps) {
  const [blameData, setBlameData] = createSignal<Map<number, BlameInfo>>(new Map());
  const [hoveredLine, setHoveredLine] = createSignal<number | null>(null);
  const [loading, setLoading] = createSignal(false);

  // Load blame data when file changes
  createEffect(() => {
    if (props.enabled && props.repoPath && props.filePath) {
      loadBlameData();
    }
  });

  const loadBlameData = async () => {
    if (!props.repoPath) return;

    setLoading(true);
    try {
      // For now, use git log as a placeholder
      // TODO: Implement actual git blame command in backend
      const commits = await gitLog(props.repoPath, 10);

      // Create mock blame data for demonstration
      const mockBlame = new Map<number, BlameInfo>();
      commits.forEach((commit, index) => {
        // Assign commits to lines (mock implementation)
        for (let line = index * 5; line < (index + 1) * 5; line++) {
          mockBlame.set(line, {
            line,
            commitId: commit.id,
            shortId: commit.short_id,
            author: commit.author,
            time: commit.time,
            message: commit.message,
          });
        }
      });

      setBlameData(mockBlame);
    } catch (e) {
      console.error("Failed to load blame data:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const getBlameForLine = (line: number): BlameInfo | undefined => {
    return blameData().get(line);
  };

  const visibleLineNumbers = () => {
    const lines: number[] = [];
    for (let i = props.visibleLines.start; i <= props.visibleLines.end; i++) {
      lines.push(i);
    }
    return lines;
  };

  return (
    <Show when={props.enabled}>
      <div class="inline-blame absolute right-0 top-0 pointer-events-auto z-20">
        <For each={visibleLineNumbers()}>
          {(lineNumber) => {
            const blame = getBlameForLine(lineNumber);
            return (
              <Show when={blame}>
                <div
                  class="absolute right-4 flex items-center gap-2 text-xs transition-opacity duration-150"
                  style={{
                    top: `${lineNumber * props.lineHeight}px`,
                    height: `${props.lineHeight}px`,
                  }}
                  onMouseEnter={() => setHoveredLine(lineNumber)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {/* Compact view */}
                  <Show when={hoveredLine() !== lineNumber}>
                    <span class="text-text-tertiary opacity-60 hover:opacity-100 transition-opacity cursor-default">
                      {blame!.author.split(" ")[0]}, {formatTime(blame!.time)}
                    </span>
                  </Show>

                  {/* Expanded view on hover */}
                  <Show when={hoveredLine() === lineNumber}>
                    <div class="flex items-center gap-2 bg-bg-secondary border border-border rounded px-2 py-1 shadow-lg">
                      <span class="text-accent font-mono">{blame!.shortId}</span>
                      <span class="text-text-secondary">{blame!.author}</span>
                      <span class="text-text-tertiary">•</span>
                      <span class="text-text-tertiary">{formatTime(blame!.time)}</span>
                      <span class="text-text-tertiary">•</span>
                      <span class="text-text-primary max-w-48 truncate" title={blame!.message}>
                        {blame!.message}
                      </span>
                    </div>
                  </Show>
                </div>
              </Show>
            );
          }}
        </For>

        {/* Loading indicator */}
        <Show when={loading()}>
          <div class="absolute right-4 top-2 text-text-tertiary text-xs">
            Loading blame...
          </div>
        </Show>
      </div>
    </Show>
  );
}
