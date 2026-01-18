/**
 * Inline Blame Component
 *
 * Shows git blame information inline at the end of each line.
 * Displays author, time, and commit message on hover.
 */

import { createSignal, createEffect, Show, For, onCleanup } from "solid-js";
import { gitBlameFile, type GitBlameLineInfo } from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";

interface InlineBlameProps {
  repoPath: string | null;
  filePath: string | null;
  visibleLines: { start: number; end: number };
  lineHeight: number;
  enabled: boolean;
}

// Cache for blame data
const blameCache = new Map<
  string,
  { data: GitBlameLineInfo[]; timestamp: number }
>();
const CACHE_TTL = 60000; // 1 minute

export function InlineBlame(props: InlineBlameProps) {
  const [blameData, setBlameData] = createSignal<GitBlameLineInfo[]>([]);
  const [hoveredLine, setHoveredLine] = createSignal<number | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  // Cleanup on unmount
  onCleanup(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  // Load blame data when file changes
  createEffect(() => {
    if (!props.enabled || !props.repoPath || !props.filePath) {
      setBlameData([]);
      return;
    }

    // Debounce to avoid excessive calls
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      loadBlameData(props.repoPath!, props.filePath!);
    }, 200);
  });

  const loadBlameData = async (repoPath: string, filePath: string) => {
    const cacheKey = `${repoPath}:${filePath}`;

    // Check cache first
    const cached = blameCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setBlameData(cached.data);
      setError(null);
      return;
    }

    // Skip if not in Tauri environment
    if (!isTauriEnvironment()) {
      setError("Git blame not available");
      setBlameData([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await gitBlameFile(repoPath, filePath);
      setBlameData(data);

      // Update cache
      blameCache.set(cacheKey, { data, timestamp: Date.now() });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Failed to load blame";
      console.error("Failed to load blame data:", e);
      setError(errorMsg);
      setBlameData([]);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: number): string => {
    if (timestamp === 0) return "unknown";

    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const formatFullDate = (timestamp: number): string => {
    if (timestamp === 0) return "Unknown date";
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getBlameForLine = (line: number): GitBlameLineInfo | undefined => {
    return blameData().find((b) => b.line === line);
  };

  const visibleLineNumbers = () => {
    const lines: number[] = [];
    for (let i = props.visibleLines.start; i <= props.visibleLines.end; i++) {
      lines.push(i);
    }
    return lines;
  };

  // Group consecutive lines with same commit for cleaner display
  const shouldShowBlame = (line: number): boolean => {
    const blame = getBlameForLine(line);
    if (!blame) return false;

    // Always show for hovered line
    if (hoveredLine() === line) return true;

    // Show for first line of a commit group
    const prevBlame = getBlameForLine(line - 1);
    return !prevBlame || prevBlame.commit_id !== blame.commit_id;
  };

  return (
    <Show when={props.enabled}>
      <div class="inline-blame absolute right-0 top-0 pointer-events-auto z-20">
        <For each={visibleLineNumbers()}>
          {(lineNumber) => {
            const blame = () => getBlameForLine(lineNumber);
            const showBlame = () => shouldShowBlame(lineNumber);

            return (
              <Show when={blame() && showBlame()}>
                <div
                  class="absolute right-4 flex items-center gap-2 text-xs transition-opacity duration-150"
                  style={{
                    top: `${(lineNumber - props.visibleLines.start) * props.lineHeight}px`,
                    height: `${props.lineHeight}px`,
                  }}
                  onMouseEnter={() => setHoveredLine(lineNumber)}
                  onMouseLeave={() => setHoveredLine(null)}
                >
                  {/* Compact view */}
                  <Show when={hoveredLine() !== lineNumber}>
                    <span class="text-text-tertiary opacity-50 hover:opacity-80 transition-opacity cursor-default font-mono text-[10px]">
                      {blame()!.author.split(" ")[0].slice(0, 12)},{" "}
                      {formatTime(blame()!.time)}
                    </span>
                  </Show>

                  {/* Expanded view on hover */}
                  <Show when={hoveredLine() === lineNumber}>
                    <div class="flex items-center gap-2 bg-bg-secondary border border-border rounded px-2 py-1 shadow-lg whitespace-nowrap">
                      <span class="text-accent font-mono text-[10px]">
                        {blame()!.short_id}
                      </span>
                      <span class="text-text-secondary text-[11px]">
                        {blame()!.author}
                      </span>
                      <span class="text-text-quaternary">•</span>
                      <span
                        class="text-text-tertiary text-[10px]"
                        title={formatFullDate(blame()!.time)}
                      >
                        {formatTime(blame()!.time)}
                      </span>
                      <span class="text-text-quaternary">•</span>
                      <span
                        class="text-text-primary text-[11px] max-w-64 truncate"
                        title={blame()!.message}
                      >
                        {blame()!.message || "(no message)"}
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
          <div class="absolute right-4 top-2 flex items-center gap-1.5 text-text-tertiary text-xs bg-bg-secondary/80 px-2 py-1 rounded">
            <div class="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" />
            Loading blame...
          </div>
        </Show>

        {/* Error indicator */}
        <Show when={error() && !loading()}>
          <div class="absolute right-4 top-2 text-red-400 text-xs bg-red-900/30 px-2 py-1 rounded">
            {error()}
          </div>
        </Show>
      </div>
    </Show>
  );
}

// Export function to invalidate cache
export function invalidateBlameCache(repoPath: string, filePath: string): void {
  blameCache.delete(`${repoPath}:${filePath}`);
}

export function clearBlameCache(): void {
  blameCache.clear();
}
