/**
 * Git Panel Component
 *
 * Source control panel with staging, committing, and branch management.
 */

import { batch, createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
import type { GitCommitInfo, GitFileChange } from "../../ipc/commands";
import * as ipc from "../../ipc/commands";

interface GitPanelProps {
  repoPath: string;
  onFileSelect?: (path: string) => void;
}

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  modified: { icon: "M", color: "text-yellow-400" },
  added: { icon: "A", color: "text-green-400" },
  deleted: { icon: "D", color: "text-red-400" },
  renamed: { icon: "R", color: "text-blue-400" },
  untracked: { icon: "U", color: "text-gray-400" },
  conflicted: { icon: "!", color: "text-red-500" },
};

export function GitPanel(props: GitPanelProps) {
  const [isLoading, setIsLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // Status
  const [branch, setBranch] = createSignal<string | null>(null);
  const [changes, setChanges] = createStore<GitFileChange[]>([]);

  // Commit
  const [commitMessage, setCommitMessage] = createSignal("");
  const [isCommitting, setIsCommitting] = createSignal(false);

  // View mode
  const [viewMode, setViewMode] = createSignal<"changes" | "history">("changes");
  const [commits, setCommits] = createStore<GitCommitInfo[]>([]);

  // Staged and unstaged files
  const stagedFiles = createMemo(() => changes.filter((c) => c.staged));
  const unstagedFiles = createMemo(() => changes.filter((c) => !c.staged));

  // Load status
  async function loadStatus() {
    if (!props.repoPath) return;

    try {
      setIsLoading(true);
      setError(null);

      const status = await ipc.gitStatus(props.repoPath);
      batch(() => {
        setBranch(status.branch);
        setChanges(status.changes);
      });
    } catch (e) {
      setError(`Failed to get status: ${e}`);
    } finally {
      setIsLoading(false);
    }
  }

  // Load commit history
  async function loadHistory() {
    if (!props.repoPath) return;

    try {
      const log = await ipc.gitLog(props.repoPath, 50);
      setCommits(log);
    } catch (e) {
      console.error("Failed to load history:", e);
    }
  }

  // Initial load
  createEffect(() => {
    if (props.repoPath) {
      loadStatus();
    }
  });

  // Load history when switching to history view
  createEffect(() => {
    if (viewMode() === "history" && commits.length === 0) {
      loadHistory();
    }
  });

  // Stage a file
  async function stageFile(path: string) {
    try {
      await ipc.gitStage(props.repoPath, path);
      await loadStatus();
    } catch (e) {
      setError(`Failed to stage file: ${e}`);
    }
  }

  // Unstage a file
  async function unstageFile(path: string) {
    try {
      await ipc.gitUnstage(props.repoPath, path);
      await loadStatus();
    } catch (e) {
      setError(`Failed to unstage file: ${e}`);
    }
  }

  // Stage all
  async function stageAll() {
    try {
      await ipc.gitStageAll(props.repoPath);
      await loadStatus();
    } catch (e) {
      setError(`Failed to stage all: ${e}`);
    }
  }

  // Discard changes
  async function discardChanges(path: string) {
    if (!confirm(`Discard changes to ${path}?`)) return;

    try {
      await ipc.gitDiscard(props.repoPath, path);
      await loadStatus();
    } catch (e) {
      setError(`Failed to discard changes: ${e}`);
    }
  }

  // Commit
  async function commit() {
    const message = commitMessage().trim();
    if (!message) {
      setError("Please enter a commit message");
      return;
    }

    if (stagedFiles().length === 0) {
      setError("No staged changes to commit");
      return;
    }

    try {
      setIsCommitting(true);
      await ipc.gitCommit(props.repoPath, message);
      setCommitMessage("");
      await loadStatus();
    } catch (e) {
      setError(`Failed to commit: ${e}`);
    } finally {
      setIsCommitting(false);
    }
  }

  function getFileName(path: string): string {
    return path.split("/").pop() || path;
  }

  function getStatusInfo(status: string) {
    return STATUS_ICONS[status] || { icon: "?", color: "text-gray-400" };
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) {
      return hours === 0 ? "Just now" : `${hours}h ago`;
    }

    const days = Math.floor(hours / 24);
    if (days < 7) {
      return `${days}d ago`;
    }

    return date.toLocaleDateString();
  }

  return (
    <div class="h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="flex items-center gap-2">
          <span class="text-text-primary font-medium">Source Control</span>
          <Show when={branch()}>
            <span class="text-xs text-accent bg-accent/20 px-2 py-0.5 rounded">{branch()}</span>
          </Show>
        </div>

        {/* Actions */}
        <div class="flex items-center gap-1">
          <button
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary"
            onClick={loadStatus}
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* View tabs */}
      <div class="flex items-center border-b border-border">
        <button
          class="px-4 py-2 text-sm"
          classList={{
            "text-text-primary border-b-2 border-accent": viewMode() === "changes",
            "text-text-secondary hover:text-text-primary": viewMode() !== "changes",
          }}
          onClick={() => setViewMode("changes")}
        >
          Changes
          <Show when={changes.length > 0}>
            <span class="ml-1 text-xs bg-bg-tertiary px-1.5 rounded">{changes.length}</span>
          </Show>
        </button>
        <button
          class="px-4 py-2 text-sm"
          classList={{
            "text-text-primary border-b-2 border-accent": viewMode() === "history",
            "text-text-secondary hover:text-text-primary": viewMode() !== "history",
          }}
          onClick={() => setViewMode("history")}
        >
          History
        </button>
      </div>

      {/* Error */}
      <Show when={error()}>
        <div class="px-3 py-2 bg-red-900/50 text-red-300 text-sm">
          {error()}
          <button class="ml-2 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      </Show>

      {/* Loading */}
      <Show when={isLoading()}>
        <div class="flex-1 flex items-center justify-center">
          <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </Show>

      {/* Changes view */}
      <Show when={!isLoading() && viewMode() === "changes"}>
        <div class="flex-1 overflow-auto">
          {/* Commit input */}
          <div class="p-3 border-b border-border">
            <textarea
              class="w-full px-3 py-2 bg-bg-secondary border border-border rounded text-text-primary text-sm placeholder:text-text-tertiary resize-none focus:outline-none focus:border-accent"
              rows={3}
              placeholder="Commit message..."
              value={commitMessage()}
              onInput={(e) => setCommitMessage(e.currentTarget.value)}
            />
            <div class="flex items-center justify-between mt-2">
              <span class="text-xs text-text-tertiary">{stagedFiles().length} staged</span>
              <button
                class="px-3 py-1 bg-accent text-white text-sm rounded hover:bg-accent/80 disabled:opacity-50"
                disabled={isCommitting() || stagedFiles().length === 0 || !commitMessage().trim()}
                onClick={commit}
              >
                {isCommitting() ? "Committing..." : "Commit"}
              </button>
            </div>
          </div>

          {/* Staged changes */}
          <Show when={stagedFiles().length > 0}>
            <div class="border-b border-border/50">
              <div class="flex items-center justify-between px-3 py-1.5 bg-bg-secondary">
                <span class="text-xs text-text-secondary font-medium uppercase">
                  Staged Changes
                </span>
                <span class="text-xs text-text-tertiary">{stagedFiles().length}</span>
              </div>
              <For each={stagedFiles()}>
                {(file) => {
                  const info = getStatusInfo(file.status);
                  return (
                    <div class="flex items-center gap-2 px-3 py-1 hover:bg-bg-hover group">
                      <span class={`w-4 text-center text-xs font-bold ${info.color}`}>
                        {info.icon}
                      </span>
                      <span
                        class="flex-1 text-sm text-text-primary truncate cursor-pointer"
                        onClick={() => props.onFileSelect?.(file.path)}
                      >
                        {getFileName(file.path)}
                      </span>
                      <span class="text-xs text-text-tertiary truncate max-w-32">{file.path}</span>
                      <button
                        class="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-text-tertiary hover:text-text-primary"
                        onClick={() => unstageFile(file.path)}
                        title="Unstage"
                      >
                        −
                      </button>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>

          {/* Unstaged changes */}
          <Show when={unstagedFiles().length > 0}>
            <div>
              <div class="flex items-center justify-between px-3 py-1.5 bg-bg-secondary">
                <span class="text-xs text-text-secondary font-medium uppercase">Changes</span>
                <div class="flex items-center gap-2">
                  <span class="text-xs text-text-tertiary">{unstagedFiles().length}</span>
                  <button class="text-xs text-accent hover:underline" onClick={stageAll}>
                    Stage All
                  </button>
                </div>
              </div>
              <For each={unstagedFiles()}>
                {(file) => {
                  const info = getStatusInfo(file.status);
                  return (
                    <div class="flex items-center gap-2 px-3 py-1 hover:bg-bg-hover group">
                      <span class={`w-4 text-center text-xs font-bold ${info.color}`}>
                        {info.icon}
                      </span>
                      <span
                        class="flex-1 text-sm text-text-primary truncate cursor-pointer"
                        onClick={() => props.onFileSelect?.(file.path)}
                      >
                        {getFileName(file.path)}
                      </span>
                      <span class="text-xs text-text-tertiary truncate max-w-32">{file.path}</span>
                      <div class="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                        <button
                          class="w-5 h-5 flex items-center justify-center text-text-tertiary hover:text-text-primary"
                          onClick={() => stageFile(file.path)}
                          title="Stage"
                        >
                          +
                        </button>
                        <button
                          class="w-5 h-5 flex items-center justify-center text-text-tertiary hover:text-red-400"
                          onClick={() => discardChanges(file.path)}
                          title="Discard"
                        >
                          ↩
                        </button>
                      </div>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>

          {/* No changes */}
          <Show when={changes.length === 0}>
            <div class="flex-1 flex items-center justify-center text-text-tertiary p-4">
              <div class="text-center">
                <div class="text-3xl mb-2">✓</div>
                <div>No changes</div>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* History view */}
      <Show when={!isLoading() && viewMode() === "history"}>
        <div class="flex-1 overflow-auto">
          <For each={commits}>
            {(commit) => (
              <div class="px-3 py-2 border-b border-border/50 hover:bg-bg-hover">
                <div class="flex items-start gap-2">
                  <span class="text-xs text-accent font-mono bg-accent/20 px-1.5 py-0.5 rounded">
                    {commit.short_id}
                  </span>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm text-text-primary truncate">{commit.message}</div>
                    <div class="text-xs text-text-tertiary mt-0.5">
                      {commit.author} • {formatTime(commit.time)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
