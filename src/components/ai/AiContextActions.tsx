/**
 * AI Context Actions
 *
 * Provides AI-powered context actions in the Context Action Palette.
 * Features:
 * - Smart code suggestions
 * - Error fixing
 * - Code explanation
 * - Refactoring suggestions
 */

import { createSignal, Show, For } from "solid-js";
import { useAi } from "./AiProvider";

export interface AiAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  action: (code: string, context?: string) => Promise<string>;
  category: "generate" | "fix" | "explain" | "refactor";
}

interface AiContextActionsProps {
  selectedCode: string;
  language: string;
  errorMessage?: string;
  onApply: (code: string) => void;
  onClose: () => void;
}

export function AiContextActions(props: AiContextActionsProps) {
  const ai = useAi();
  const [result, setResult] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [selectedAction, setSelectedAction] = createSignal<string | null>(null);

  const actions: AiAction[] = [
    {
      id: "explain",
      label: "Explain Code",
      description: "Get a detailed explanation of what this code does",
      icon: "💡",
      category: "explain",
      action: async (code) => ai.explainCode(code),
    },
    {
      id: "improve",
      label: "Improve Code",
      description: "Suggest improvements for better quality and performance",
      icon: "✨",
      category: "refactor",
      action: async (code) =>
        ai.getCodeSuggestion(
          code,
          "Improve this code for better readability, performance, and best practices. Keep the same functionality."
        ),
    },
    {
      id: "fix-error",
      label: "Fix Error",
      description: "Fix the error in this code",
      icon: "🔧",
      category: "fix",
      action: async (code, context) =>
        ai.fixError(code, context || "There is an error in this code"),
    },
    {
      id: "add-types",
      label: "Add TypeScript Types",
      description: "Add proper TypeScript type annotations",
      icon: "📝",
      category: "refactor",
      action: async (code) =>
        ai.getCodeSuggestion(
          code,
          "Add comprehensive TypeScript type annotations to this code. Include interfaces and type definitions."
        ),
    },
    {
      id: "add-comments",
      label: "Add Comments",
      description: "Add helpful comments and documentation",
      icon: "📖",
      category: "refactor",
      action: async (code) =>
        ai.getCodeSuggestion(
          code,
          "Add clear, helpful comments and JSDoc documentation to this code."
        ),
    },
    {
      id: "simplify",
      label: "Simplify",
      description: "Simplify this code while maintaining functionality",
      icon: "🎯",
      category: "refactor",
      action: async (code) =>
        ai.getCodeSuggestion(
          code,
          "Simplify this code. Make it more concise and easier to understand while keeping the same functionality."
        ),
    },
    {
      id: "tests",
      label: "Generate Tests",
      description: "Generate unit tests for this code",
      icon: "🧪",
      category: "generate",
      action: async (code) =>
        ai.generateCode(
          `Generate comprehensive unit tests for the following code:\n\n${code}`,
          props.language
        ),
    },
    {
      id: "debug",
      label: "Add Debug Logging",
      description: "Add useful debug logging statements",
      icon: "🐛",
      category: "refactor",
      action: async (code) =>
        ai.getCodeSuggestion(
          code,
          "Add helpful debug logging statements to this code. Use console.log or appropriate logging for the language."
        ),
    },
  ];

  const handleActionClick = async (action: AiAction) => {
    if (!ai.state.apiKey) {
      setError("Please configure your OpenRouter API key first");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSelectedAction(action.id);

    try {
      const response = await action.action(props.selectedCode, props.errorMessage);
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to process request");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    const code = result();
    if (code) {
      // Extract code from markdown code blocks if present
      const codeMatch = code.match(/```\w*\n([\s\S]*?)```/);
      props.onApply(codeMatch ? codeMatch[1].trim() : code.trim());
    }
  };

  const groupedActions = () => {
    const groups: Record<string, AiAction[]> = {
      explain: [],
      fix: [],
      refactor: [],
      generate: [],
    };

    for (const action of actions) {
      groups[action.category].push(action);
    }

    return groups;
  };

  return (
    <div class="ai-context-actions bg-bg-primary border border-border rounded-lg shadow-xl overflow-hidden w-96">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary">
        <div class="flex items-center gap-2">
          <span class="text-lg">🤖</span>
          <span class="text-sm font-medium text-text-primary">AI Actions</span>
        </div>
        <button
          class="text-text-tertiary hover:text-text-primary transition-colors"
          onClick={props.onClose}
        >
          ✕
        </button>
      </div>

      {/* No API Key Warning */}
      <Show when={!ai.state.apiKey}>
        <div class="p-3 bg-yellow-900/20 text-yellow-300 text-xs">
          ⚠️ Configure OpenRouter API key in AI panel settings
        </div>
      </Show>

      {/* Actions List */}
      <Show when={!result()}>
        <div class="max-h-72 overflow-y-auto">
          <For each={Object.entries(groupedActions())}>
            {([category, categoryActions]) => (
              <Show when={categoryActions.length > 0}>
                <div class="px-3 py-1 text-[10px] uppercase tracking-wider text-text-quaternary bg-bg-tertiary/50">
                  {category}
                </div>
                <For each={categoryActions}>
                  {(action) => (
                    <button
                      class="w-full flex items-center gap-3 px-3 py-2 hover:bg-bg-secondary transition-colors text-left disabled:opacity-50"
                      onClick={() => handleActionClick(action)}
                      disabled={loading() || !ai.state.apiKey}
                    >
                      <span class="text-lg">{action.icon}</span>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm text-text-primary">{action.label}</div>
                        <div class="text-xs text-text-tertiary truncate">
                          {action.description}
                        </div>
                      </div>
                      <Show when={loading() && selectedAction() === action.id}>
                        <div class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                      </Show>
                    </button>
                  )}
                </For>
              </Show>
            )}
          </For>
        </div>
      </Show>

      {/* Result View */}
      <Show when={result()}>
        <div class="p-3 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-text-primary">Result</span>
            <button
              class="text-xs text-text-tertiary hover:text-text-primary transition-colors"
              onClick={() => setResult(null)}
            >
              ← Back
            </button>
          </div>

          <div class="max-h-64 overflow-y-auto">
            <pre class="p-3 bg-bg-tertiary rounded text-xs font-mono text-text-secondary whitespace-pre-wrap">
              {result()}
            </pre>
          </div>

          <div class="flex gap-2">
            <button
              class="flex-1 px-3 py-2 text-sm bg-accent hover:bg-accent/90 text-white rounded transition-colors"
              onClick={handleApply}
            >
              Apply Changes
            </button>
            <button
              class="px-3 py-2 text-sm bg-bg-secondary hover:bg-bg-tertiary text-text-secondary border border-border rounded transition-colors"
              onClick={() => navigator.clipboard.writeText(result()!)}
            >
              Copy
            </button>
          </div>
        </div>
      </Show>

      {/* Error Display */}
      <Show when={error()}>
        <div class="p-3 bg-red-900/30 border-t border-red-700/50 text-red-300 text-xs">
          {error()}
        </div>
      </Show>

      {/* Footer */}
      <div class="px-3 py-2 border-t border-border bg-bg-secondary/50 text-[10px] text-text-quaternary">
        Powered by {AI_MODELS.find((m) => m.id === ai.state.selectedModel)?.name || "AI"}
      </div>
    </div>
  );
}
