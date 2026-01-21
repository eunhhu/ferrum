/**
 * AI Chat Panel
 *
 * A chat interface for interacting with AI models.
 * Features:
 * - Multi-model selection
 * - Conversation history
 * - Code block rendering
 * - Usage tracking
 */

import { createSignal, For, Show, createEffect } from "solid-js";
import { useAi, AI_MODELS } from "./AiProvider";

interface AiChatPanelProps {
  onInsertCode?: (code: string) => void;
  selectedCode?: string;
}

export function AiChatPanel(props: AiChatPanelProps) {
  const ai = useAi();
  const [input, setInput] = createSignal("");
  const [showSettings, setShowSettings] = createSignal(false);
  const [apiKeyInput, setApiKeyInput] = createSignal("");

  let messagesEndRef: HTMLDivElement | undefined;

  // Scroll to bottom when messages change
  createEffect(() => {
    if (ai.state.messages.length > 0 && messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: "smooth" });
    }
  });

  const handleSend = async () => {
    const message = input().trim();
    if (!message || ai.state.isLoading) return;

    // Include selected code if available
    let fullMessage = message;
    if (props.selectedCode) {
      fullMessage = `Regarding this code:\n\`\`\`\n${props.selectedCode}\n\`\`\`\n\n${message}`;
    }

    setInput("");

    try {
      await ai.sendMessage(fullMessage);
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveApiKey = () => {
    ai.setApiKey(apiKeyInput());
    setShowSettings(false);
  };

  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(4)}`;
  };

  const renderCodeBlock = (content: string) => {
    // Simple markdown code block parser
    const parts: {
      type: "text" | "code";
      content: string;
      language?: string;
    }[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: content.slice(lastIndex, match.index),
        });
      }
      // Add code block
      const codeEntry: {
        type: "text" | "code";
        content: string;
        language?: string;
      } = {
        type: "code",
        content: match[2] ?? "",
      };
      if (match[1]) {
        codeEntry.language = match[1];
      }
      parts.push(codeEntry);
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push({ type: "text", content: content.slice(lastIndex) });
    }

    return (
      <div class="space-y-2">
        <For each={parts}>
          {(part) =>
            part.type === "code" ? (
              <div class="relative group">
                <div class="flex items-center justify-between bg-bg-tertiary px-2 py-1 rounded-t text-xs text-text-tertiary">
                  <span>{part.language || "code"}</span>
                  <button
                    class="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 bg-accent/20 hover:bg-accent/30 rounded text-accent"
                    onClick={() => props.onInsertCode?.(part.content)}
                  >
                    Insert
                  </button>
                </div>
                <pre class="bg-bg-tertiary p-3 rounded-b overflow-x-auto text-sm font-mono text-text-primary">
                  {part.content}
                </pre>
              </div>
            ) : (
              <p class="text-text-secondary whitespace-pre-wrap">
                {part.content}
              </p>
            )
          }
        </For>
      </div>
    );
  };

  return (
    <div class="ai-chat-panel h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-text-primary">
            AI Assistant
          </span>
          <Show when={ai.state.isLoading}>
            <div class="w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <select
            class="px-2 py-1 text-xs bg-bg-secondary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
            value={ai.state.selectedModel}
            onChange={(e) => ai.selectModel(e.currentTarget.value)}
          >
            <For each={AI_MODELS}>
              {(model) => <option value={model.id}>{model.name}</option>}
            </For>
          </select>
          <button
            class="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            onClick={() => setShowSettings(!showSettings())}
            title="Settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      <Show when={showSettings()}>
        <div class="p-3 border-b border-border bg-bg-secondary space-y-2">
          <div>
            <label class="block text-xs text-text-tertiary mb-1">
              OpenRouter API Key
            </label>
            <div class="flex gap-2">
              <input
                type="password"
                class="flex-1 px-2 py-1 text-sm bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
                placeholder="sk-or-..."
                value={apiKeyInput()}
                onInput={(e) => setApiKeyInput(e.currentTarget.value)}
              />
              <button
                class="px-3 py-1 text-sm bg-accent hover:bg-accent/90 text-white rounded transition-colors"
                onClick={handleSaveApiKey}
              >
                Save
              </button>
            </div>
            <p class="text-[10px] text-text-quaternary mt-1">
              Get your API key from{" "}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                class="text-accent hover:underline"
              >
                openrouter.ai/keys
              </a>
            </p>
          </div>

          {/* Usage Stats */}
          <div class="pt-2 border-t border-border">
            <div class="text-xs text-text-tertiary">Session Usage</div>
            <div class="flex gap-4 text-xs text-text-secondary mt-1">
              <span>Tokens: {ai.state.usage.totalTokens.toLocaleString()}</span>
              <span>Cost: {formatCost(ai.state.usage.estimatedCost)}</span>
            </div>
          </div>
        </div>
      </Show>

      {/* No API Key Warning */}
      <Show when={!ai.state.apiKey}>
        <div class="p-3 bg-yellow-900/20 border-b border-yellow-700/50 text-yellow-300 text-sm">
          <p>
            ⚠️ No API key configured. Click the ⚙️ icon to add your OpenRouter
            API key.
          </p>
        </div>
      </Show>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-3 space-y-4">
        <Show when={ai.state.messages.length === 0}>
          <div class="text-center py-8">
            <div class="text-4xl mb-2">🤖</div>
            <h3 class="text-lg font-medium text-text-primary mb-1">
              AI Assistant
            </h3>
            <p class="text-sm text-text-tertiary max-w-xs mx-auto">
              Ask me to explain code, fix errors, generate snippets, or help
              with any coding task.
            </p>
            <Show when={props.selectedCode}>
              <p class="text-xs text-accent mt-2">
                Code selected - I'll include it in your message.
              </p>
            </Show>
          </div>
        </Show>

        <For each={ai.state.messages}>
          {(message) => (
            <div
              class={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                class={`max-w-[85%] rounded-lg px-3 py-2 ${
                  message.role === "user"
                    ? "bg-accent text-white"
                    : "bg-bg-secondary text-text-primary"
                }`}
              >
                {message.role === "assistant" ? (
                  renderCodeBlock(message.content)
                ) : (
                  <p class="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
                <div class="text-[10px] opacity-50 mt-1">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          )}
        </For>

        {/* Error Display */}
        <Show when={ai.state.error}>
          <div class="p-3 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-sm">
            {ai.state.error}
          </div>
        </Show>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div class="p-3 border-t border-border">
        <Show when={props.selectedCode}>
          <div class="mb-2 px-2 py-1 bg-accent/10 border border-accent/30 rounded text-xs text-accent">
            📎 Code attached ({props.selectedCode?.split("\n").length ?? 0}{" "}
            lines)
          </div>
        </Show>

        <div class="flex gap-2">
          <textarea
            class="flex-1 px-3 py-2 text-sm bg-bg-secondary border border-border rounded resize-none text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent"
            placeholder="Ask me anything about code..."
            rows={2}
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={ai.state.isLoading || !ai.state.apiKey}
          />
          <button
            class="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSend}
            disabled={ai.state.isLoading || !input().trim() || !ai.state.apiKey}
          >
            Send
          </button>
        </div>

        <div class="flex items-center justify-between mt-2 text-[10px] text-text-quaternary">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <button
            class="hover:text-text-tertiary transition-colors"
            onClick={() => ai.clearHistory()}
          >
            Clear history
          </button>
        </div>
      </div>
    </div>
  );
}
