/**
 * Search Panel Component
 *
 * Provides file search and text search functionality.
 */

import {
  createSignal,
  createEffect,
  For,
  Show,
  batch,
} from "solid-js";
import { createStore } from "solid-js/store";
import * as ipc from "../../ipc/commands";

interface FileResult {
  path: string;
  score: number;
}

interface TextResult {
  path: string;
  line: number;
  column: number;
  content: string;
  match_start: number;
  match_end: number;
}

interface SearchPanelProps {
  onFileSelect?: (path: string) => void;
  onLocationSelect?: (path: string, line: number, column: number) => void;
}

export function SearchPanel(props: SearchPanelProps) {
  const [mode, setMode] = createSignal<"files" | "text">("text");
  const [query, setQuery] = createSignal("");
  const [isSearching, setIsSearching] = createSignal(false);

  // Search options
  const [caseSensitive, setCaseSensitive] = createSignal(false);
  const [wholeWord, setWholeWord] = createSignal(false);
  const [useRegex, setUseRegex] = createSignal(false);

  // Results
  const [fileResults, setFileResults] = createStore<FileResult[]>([]);
  const [textResults, setTextResults] = createStore<TextResult[]>([]);

  // Expanded files in text search
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());

  // Group text results by file
  const groupedTextResults = () => {
    const groups: Record<string, TextResult[]> = {};
    for (const result of textResults) {
      if (!groups[result.path]) {
        groups[result.path] = [];
      }
      groups[result.path].push(result);
    }
    return groups;
  };

  // Perform search
  async function performSearch() {
    const q = query().trim();
    if (!q) {
      batch(() => {
        setFileResults([]);
        setTextResults([]);
      });
      return;
    }

    setIsSearching(true);

    try {
      if (mode() === "files") {
        const results = await ipc.searchFiles(q, 100);
        setFileResults(results);
      } else {
        const results = await ipc.searchText(".", q, {
          case_sensitive: caseSensitive(),
          whole_word: wholeWord(),
          regex: useRegex(),
          max_results: 1000,
        });
        setTextResults(results);

        // Expand first few files
        const files = [...new Set(results.slice(0, 5).map((r) => r.path))];
        setExpandedFiles(new Set(files));
      }
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsSearching(false);
    }
  }

  // Debounced search
  let searchTimeout: ReturnType<typeof setTimeout>;
  createEffect(() => {
    const q = query();
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(performSearch, 300);
  });

  function toggleFile(path: string) {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function getFileName(path: string): string {
    return path.split("/").pop() || path;
  }

  function highlightMatch(content: string, start: number, end: number) {
    const before = content.slice(0, start);
    const match = content.slice(start, end);
    const after = content.slice(end);

    return (
      <>
        <span class="text-text-secondary">{before}</span>
        <span class="text-accent bg-accent/20 font-medium">{match}</span>
        <span class="text-text-secondary">{after}</span>
      </>
    );
  }

  return (
    <div class="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div class="p-2 border-b border-border">
        {/* Mode tabs */}
        <div class="flex items-center gap-1 mb-2">
          <button
            class="px-3 py-1 text-sm rounded"
            classList={{
              "bg-accent text-white": mode() === "text",
              "text-text-secondary hover:text-text-primary hover:bg-bg-hover": mode() !== "text",
            }}
            onClick={() => setMode("text")}
          >
            Search in Files
          </button>
          <button
            class="px-3 py-1 text-sm rounded"
            classList={{
              "bg-accent text-white": mode() === "files",
              "text-text-secondary hover:text-text-primary hover:bg-bg-hover": mode() !== "files",
            }}
            onClick={() => setMode("files")}
          >
            Find Files
          </button>
        </div>

        {/* Search input */}
        <div class="relative">
          <input
            type="text"
            class="w-full px-3 py-1.5 pr-20 bg-bg-secondary border border-border rounded text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-accent"
            placeholder={mode() === "files" ? "Search files by name..." : "Search in files..."}
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
          />

          {/* Loading indicator */}
          <Show when={isSearching()}>
            <div class="absolute right-3 top-1/2 -translate-y-1/2">
              <div class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          </Show>
        </div>

        {/* Search options (for text search) */}
        <Show when={mode() === "text"}>
          <div class="flex items-center gap-3 mt-2">
            <label class="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                class="rounded"
                checked={caseSensitive()}
                onChange={(e) => setCaseSensitive(e.currentTarget.checked)}
              />
              Case Sensitive
            </label>
            <label class="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                class="rounded"
                checked={wholeWord()}
                onChange={(e) => setWholeWord(e.currentTarget.checked)}
              />
              Whole Word
            </label>
            <label class="flex items-center gap-1.5 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                class="rounded"
                checked={useRegex()}
                onChange={(e) => setUseRegex(e.currentTarget.checked)}
              />
              Regex
            </label>
          </div>
        </Show>
      </div>

      {/* Results */}
      <div class="flex-1 overflow-auto">
        {/* File search results */}
        <Show when={mode() === "files"}>
          <Show
            when={fileResults.length > 0}
            fallback={
              <Show when={query().trim()}>
                <div class="p-4 text-center text-text-tertiary text-sm">
                  No files found
                </div>
              </Show>
            }
          >
            <For each={fileResults}>
              {(result) => (
                <div
                  class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-bg-hover"
                  onClick={() => props.onFileSelect?.(result.path)}
                >
                  <span class="text-sm">📄</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-text-primary text-sm truncate">
                      {getFileName(result.path)}
                    </div>
                    <div class="text-text-tertiary text-xs truncate">
                      {result.path}
                    </div>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </Show>

        {/* Text search results */}
        <Show when={mode() === "text"}>
          <Show
            when={Object.keys(groupedTextResults()).length > 0}
            fallback={
              <Show when={query().trim()}>
                <div class="p-4 text-center text-text-tertiary text-sm">
                  No results found
                </div>
              </Show>
            }
          >
            <div class="text-xs text-text-tertiary px-3 py-1.5 border-b border-border/50">
              {textResults.length} results in {Object.keys(groupedTextResults()).length} files
            </div>
            <For each={Object.entries(groupedTextResults())}>
              {([path, results]) => (
                <div class="border-b border-border/50">
                  {/* File header */}
                  <div
                    class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-bg-hover sticky top-0 bg-bg-primary"
                    onClick={() => toggleFile(path)}
                  >
                    <span
                      class="text-text-tertiary transition-transform text-xs"
                      classList={{ "rotate-90": expandedFiles().has(path) }}
                    >
                      ▶
                    </span>
                    <span class="text-sm">📄</span>
                    <span class="text-text-primary text-sm truncate flex-1">
                      {getFileName(path)}
                    </span>
                    <span class="text-text-tertiary text-xs bg-bg-tertiary px-1.5 py-0.5 rounded">
                      {results.length}
                    </span>
                  </div>

                  {/* Match results */}
                  <Show when={expandedFiles().has(path)}>
                    <For each={results}>
                      {(result) => (
                        <div
                          class="flex items-start gap-2 px-3 py-1 pl-8 cursor-pointer hover:bg-bg-hover"
                          onClick={() =>
                            props.onLocationSelect?.(result.path, result.line, result.column)
                          }
                        >
                          <span class="text-text-tertiary text-xs w-8 text-right shrink-0">
                            {result.line}
                          </span>
                          <div class="text-sm font-mono truncate flex-1">
                            {highlightMatch(
                              result.content,
                              result.match_start,
                              result.match_end
                            )}
                          </div>
                        </div>
                      )}
                    </For>
                  </Show>
                </div>
              )}
            </For>
          </Show>
        </Show>
      </div>
    </div>
  );
}
