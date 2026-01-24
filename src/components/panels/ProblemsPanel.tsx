/**
 * Problems Panel Component
 *
 * Displays diagnostics (errors, warnings) from LSP servers.
 */

import { createMemo, createSignal, For, Show } from "solid-js";
import type { LspDiagnostic } from "../../ipc/commands";

// Diagnostic severity icons and colors
const SEVERITY_CONFIG: Record<number, { icon: string; color: string; label: string }> = {
  1: { icon: "❌", color: "text-red-400", label: "Error" },
  2: { icon: "⚠️", color: "text-yellow-400", label: "Warning" },
  3: { icon: "ℹ️", color: "text-blue-400", label: "Info" },
  4: { icon: "💡", color: "text-gray-400", label: "Hint" },
};

interface FileDiagnostics {
  path: string;
  diagnostics: LspDiagnostic[];
}

interface ProblemsPanelProps {
  diagnostics: FileDiagnostics[];
  onDiagnosticClick: (path: string, line: number, character: number) => void;
}

export function ProblemsPanel(props: ProblemsPanelProps) {
  const [filter, setFilter] = createSignal<"all" | "errors" | "warnings">("all");
  const [expandedFiles, setExpandedFiles] = createSignal<Set<string>>(new Set());

  // Filter diagnostics
  const filteredDiagnostics = createMemo(() => {
    return props.diagnostics
      .map((file) => ({
        ...file,
        diagnostics: file.diagnostics.filter((d) => {
          if (filter() === "errors") return d.severity === 1;
          if (filter() === "warnings") return d.severity === 2;
          return true;
        }),
      }))
      .filter((file) => file.diagnostics.length > 0);
  });

  // Count totals
  const counts = createMemo(() => {
    let errors = 0;
    let warnings = 0;
    let infos = 0;

    for (const file of props.diagnostics) {
      for (const d of file.diagnostics) {
        if (d.severity === 1) errors++;
        else if (d.severity === 2) warnings++;
        else infos++;
      }
    }

    return { errors, warnings, infos, total: errors + warnings + infos };
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

  function getSeverityConfig(severity: number) {
    return SEVERITY_CONFIG[severity] || SEVERITY_CONFIG[3];
  }

  function getFileName(path: string): string {
    return path.split("/").pop() || path;
  }

  return (
    <div class="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="flex items-center gap-4">
          <span class="text-text-primary font-medium">Problems</span>

          {/* Counts */}
          <div class="flex items-center gap-3 text-xs">
            <span class="flex items-center gap-1 text-red-400">❌ {counts().errors}</span>
            <span class="flex items-center gap-1 text-yellow-400">⚠️ {counts().warnings}</span>
            <span class="flex items-center gap-1 text-blue-400">ℹ️ {counts().infos}</span>
          </div>
        </div>

        {/* Filter buttons */}
        <div class="flex items-center gap-1">
          <button
            class="px-2 py-1 text-xs rounded"
            classList={{
              "bg-accent text-white": filter() === "all",
              "text-text-secondary hover:text-text-primary": filter() !== "all",
            }}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            class="px-2 py-1 text-xs rounded"
            classList={{
              "bg-red-600 text-white": filter() === "errors",
              "text-text-secondary hover:text-text-primary": filter() !== "errors",
            }}
            onClick={() => setFilter("errors")}
          >
            Errors
          </button>
          <button
            class="px-2 py-1 text-xs rounded"
            classList={{
              "bg-yellow-600 text-white": filter() === "warnings",
              "text-text-secondary hover:text-text-primary": filter() !== "warnings",
            }}
            onClick={() => setFilter("warnings")}
          >
            Warnings
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-auto">
        <Show
          when={filteredDiagnostics().length > 0}
          fallback={
            <div class="flex items-center justify-center h-full text-text-tertiary">
              <div class="text-center">
                <div class="text-3xl mb-2">✓</div>
                <div>No problems detected</div>
              </div>
            </div>
          }
        >
          <For each={filteredDiagnostics()}>
            {(file) => (
              <div class="border-b border-border/50">
                {/* File header */}
                <div
                  class="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-bg-hover"
                  onClick={() => toggleFile(file.path)}
                >
                  {/* Expand arrow */}
                  <span
                    class="text-text-tertiary transition-transform text-xs"
                    classList={{
                      "rotate-90": expandedFiles().has(file.path),
                    }}
                  >
                    ▶
                  </span>

                  {/* File icon */}
                  <span class="text-sm">📄</span>

                  {/* File name */}
                  <span class="text-text-primary text-sm">{getFileName(file.path)}</span>

                  {/* Path */}
                  <span class="text-text-tertiary text-xs truncate flex-1">{file.path}</span>

                  {/* Count badge */}
                  <span class="text-text-tertiary text-xs bg-bg-tertiary px-1.5 py-0.5 rounded">
                    {file.diagnostics.length}
                  </span>
                </div>

                {/* Diagnostics list */}
                <Show when={expandedFiles().has(file.path)}>
                  <For each={file.diagnostics}>
                    {(diagnostic) => {
                      const config = getSeverityConfig(diagnostic.severity);
                      return (
                        <div
                          class="flex items-start gap-2 px-3 py-1.5 pl-8 cursor-pointer hover:bg-bg-hover"
                          onClick={() =>
                            props.onDiagnosticClick(
                              file.path,
                              diagnostic.range.start.line,
                              diagnostic.range.start.character
                            )
                          }
                        >
                          {/* Severity icon */}
                          <span class={config?.color ?? "text-gray-400"}>
                            {config?.icon ?? "?"}
                          </span>

                          {/* Message */}
                          <div class="flex-1 min-w-0">
                            <div class="text-text-primary text-sm">{diagnostic.message}</div>
                            <div class="text-text-tertiary text-xs flex items-center gap-2">
                              <span>
                                [{diagnostic.range.start.line + 1}:
                                {diagnostic.range.start.character + 1}]
                              </span>
                              <Show when={diagnostic.source}>
                                <span>{diagnostic.source}</span>
                              </Show>
                              <Show when={diagnostic.code}>
                                <span class="font-mono">{diagnostic.code}</span>
                              </Show>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                  </For>
                </Show>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
