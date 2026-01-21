/**
 * Environment Manager Panel
 *
 * Displays and manages environment variables in the project.
 * Features:
 * - Auto-detection of env variable usage in code
 * - .env.example generation
 * - TypeScript type definitions generation
 * - Visual indication of missing/unused variables
 */

import { createSignal, createEffect, For, Show } from "solid-js";
import {
  scanEnvVariables,
  writeEnvExample,
  writeEnvTypes,
  type EnvScanResult,
  type EnvVariableInfo,
} from "../../ipc/commands";
import { isTauriEnvironment } from "../../ipc/tauri-check";

interface EnvManagerPanelProps {
  projectPath: string | null;
  onFileClick?: (filePath: string, line: number) => void;
}

export function EnvManagerPanel(props: EnvManagerPanelProps) {
  const [scanResult, setScanResult] = createSignal<EnvScanResult | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [expandedVars, setExpandedVars] = createSignal<Set<string>>(new Set());
  const [filter, setFilter] = createSignal<"all" | "missing" | "unused">("all");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [generating, setGenerating] = createSignal<string | null>(null);

  // Load env variables when project changes
  createEffect(() => {
    if (props.projectPath) {
      loadEnvVariables(props.projectPath);
    }
  });

  const loadEnvVariables = async (projectPath: string) => {
    if (!isTauriEnvironment()) {
      setError("Env Manager not available in browser");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await scanEnvVariables(projectPath);
      setScanResult(result);
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "Failed to scan environment variables";
      console.error("Failed to scan env variables:", e);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEnvExample = async () => {
    if (!props.projectPath) return;

    setGenerating("example");
    try {
      await writeEnvExample(props.projectPath);
      // Refresh after generation
      await loadEnvVariables(props.projectPath);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to generate .env.example"
      );
    } finally {
      setGenerating(null);
    }
  };

  const handleGenerateEnvTypes = async () => {
    if (!props.projectPath) return;

    setGenerating("types");
    try {
      await writeEnvTypes(props.projectPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate env.d.ts");
    } finally {
      setGenerating(null);
    }
  };

  const toggleVarExpanded = (name: string) => {
    setExpandedVars((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const filteredVariables = () => {
    const result = scanResult();
    if (!result) return [];

    let vars = result.variables;
    const query = searchQuery().toLowerCase();

    // Apply search filter
    if (query) {
      vars = vars.filter((v) => v.name.toLowerCase().includes(query));
    }

    // Apply status filter
    switch (filter()) {
      case "missing":
        vars = vars.filter((v) => result.missing_in_env.includes(v.name));
        break;
      case "unused":
        vars = vars.filter((v) => result.unused_in_code.includes(v.name));
        break;
    }

    // Sort by name
    return [...vars].sort((a, b) => a.name.localeCompare(b.name));
  };

  const getVarStatus = (
    varInfo: EnvVariableInfo
  ): "ok" | "missing" | "unused" => {
    const result = scanResult();
    if (!result) return "ok";

    if (result.missing_in_env.includes(varInfo.name)) return "missing";
    if (result.unused_in_code.includes(varInfo.name)) return "unused";
    return "ok";
  };

  const getStatusColor = (status: "ok" | "missing" | "unused"): string => {
    switch (status) {
      case "ok":
        return "bg-green-500";
      case "missing":
        return "bg-red-500";
      case "unused":
        return "bg-yellow-500";
    }
  };

  const getStatusText = (status: "ok" | "missing" | "unused"): string => {
    switch (status) {
      case "ok":
        return "Defined & Used";
      case "missing":
        return "Missing in .env";
      case "unused":
        return "Unused in code";
    }
  };

  return (
    <div class="env-manager-panel h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-text-primary">
            Environment Variables
          </span>
          <Show when={scanResult()}>
            <span class="text-xs text-text-tertiary">
              ({scanResult()!.variables.length} vars)
            </span>
          </Show>
        </div>
        <button
          class="text-xs text-text-secondary hover:text-text-primary transition-colors"
          onClick={() =>
            props.projectPath && loadEnvVariables(props.projectPath)
          }
          disabled={loading()}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div class="px-3 py-2 border-b border-border space-y-2">
        {/* Search */}
        <input
          type="text"
          placeholder="Search variables..."
          class="w-full px-2 py-1 text-xs bg-bg-secondary border border-border rounded focus:outline-none focus:border-accent"
          value={searchQuery()}
          onInput={(e) => setSearchQuery(e.currentTarget.value)}
        />

        {/* Filters */}
        <div class="flex items-center gap-2">
          <button
            class={`px-2 py-0.5 text-xs rounded transition-colors ${
              filter() === "all"
                ? "bg-accent text-white"
                : "bg-bg-secondary text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            class={`px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1 ${
              filter() === "missing"
                ? "bg-red-600 text-white"
                : "bg-bg-secondary text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setFilter("missing")}
          >
            <span class="w-1.5 h-1.5 rounded-full bg-red-500" />
            Missing ({scanResult()?.missing_in_env.length || 0})
          </button>
          <button
            class={`px-2 py-0.5 text-xs rounded transition-colors flex items-center gap-1 ${
              filter() === "unused"
                ? "bg-yellow-600 text-white"
                : "bg-bg-secondary text-text-secondary hover:text-text-primary"
            }`}
            onClick={() => setFilter("unused")}
          >
            <span class="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            Unused ({scanResult()?.unused_in_code.length || 0})
          </button>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-2">
          <button
            class="px-2 py-1 text-xs bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary border border-border rounded transition-colors disabled:opacity-50"
            onClick={handleGenerateEnvExample}
            disabled={generating() !== null || !scanResult()}
          >
            {generating() === "example"
              ? "Generating..."
              : "Generate .env.example"}
          </button>
          <button
            class="px-2 py-1 text-xs bg-bg-secondary hover:bg-bg-tertiary text-text-secondary hover:text-text-primary border border-border rounded transition-colors disabled:opacity-50"
            onClick={handleGenerateEnvTypes}
            disabled={generating() !== null || !scanResult()}
          >
            {generating() === "types" ? "Generating..." : "Generate env.d.ts"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        {/* Loading state */}
        <Show when={loading()}>
          <div class="flex items-center justify-center py-8">
            <div class="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span class="ml-2 text-sm text-text-tertiary">
              Scanning project...
            </span>
          </div>
        </Show>

        {/* Error state */}
        <Show when={error() && !loading()}>
          <div class="px-3 py-4 text-center">
            <div class="text-red-400 text-sm">{error()}</div>
          </div>
        </Show>

        {/* Variables list */}
        <Show when={!loading() && scanResult()}>
          {/* Env files info */}
          <Show when={scanResult()!.env_files.length > 0}>
            <div class="px-3 py-2 border-b border-border">
              <div class="text-xs text-text-tertiary">
                Found: {scanResult()!.env_files.join(", ")}
              </div>
            </div>
          </Show>

          {/* Variables */}
          <For each={filteredVariables()}>
            {(varInfo) => {
              const status = getVarStatus(varInfo);
              const isExpanded = () => expandedVars().has(varInfo.name);

              return (
                <div class="border-b border-border">
                  {/* Variable header */}
                  <div
                    class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-bg-secondary transition-colors"
                    onClick={() => toggleVarExpanded(varInfo.name)}
                  >
                    <span class="text-text-tertiary text-xs">
                      {isExpanded() ? "▼" : "▶"}
                    </span>
                    <span
                      class={`w-2 h-2 rounded-full ${getStatusColor(status)}`}
                    />
                    <span class="font-mono text-sm text-text-primary">
                      {varInfo.name}
                    </span>
                    <Show when={varInfo.is_secret}>
                      <span class="px-1 py-0.5 text-[10px] bg-red-900/50 text-red-300 rounded">
                        SECRET
                      </span>
                    </Show>
                    <span class="flex-1" />
                    <span class="text-xs text-text-tertiary">
                      {getStatusText(status)}
                    </span>
                    <Show when={varInfo.usages.length > 0}>
                      <span class="text-xs text-text-quaternary">
                        ({varInfo.usages.length} usages)
                      </span>
                    </Show>
                  </div>

                  {/* Expanded details */}
                  <Show when={isExpanded()}>
                    <div class="px-6 py-2 bg-bg-secondary/50 space-y-2">
                      {/* Value */}
                      <Show when={varInfo.value !== null}>
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-text-tertiary w-16">
                            Value:
                          </span>
                          <span class="font-mono text-xs text-text-secondary">
                            {varInfo.is_secret ? "••••••••" : varInfo.value}
                          </span>
                        </div>
                      </Show>

                      {/* Usages */}
                      <Show when={varInfo.usages.length > 0}>
                        <div>
                          <span class="text-xs text-text-tertiary">
                            Usages:
                          </span>
                          <div class="mt-1 space-y-1">
                            <For each={varInfo.usages.slice(0, 5)}>
                              {(usage) => (
                                <div
                                  class="flex items-center gap-2 px-2 py-1 rounded bg-bg-tertiary/50 hover:bg-bg-tertiary cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    props.onFileClick?.(
                                      usage.file_path,
                                      usage.line
                                    );
                                  }}
                                >
                                  <span class="font-mono text-xs text-accent truncate">
                                    {usage.file_path}
                                  </span>
                                  <span class="text-xs text-text-quaternary">
                                    :{usage.line}
                                  </span>
                                </div>
                              )}
                            </For>
                            <Show when={varInfo.usages.length > 5}>
                              <div class="text-xs text-text-quaternary px-2">
                                +{varInfo.usages.length - 5} more usages
                              </div>
                            </Show>
                          </div>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>

          {/* Empty state */}
          <Show when={filteredVariables().length === 0}>
            <div class="px-3 py-8 text-center">
              <div class="text-text-tertiary text-sm">
                {searchQuery() || filter() !== "all"
                  ? "No variables match the current filter"
                  : "No environment variables detected"}
              </div>
            </div>
          </Show>
        </Show>

        {/* No project state */}
        <Show when={!props.projectPath && !loading()}>
          <div class="px-3 py-8 text-center">
            <div class="text-text-tertiary text-sm">
              Open a project to scan for environment variables
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
