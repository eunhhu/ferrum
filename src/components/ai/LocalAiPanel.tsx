/**
 * Local AI Panel
 *
 * UI for managing and interacting with local AI models via Ollama.
 * Features:
 * - Model list and management
 * - Model download (pull)
 * - Chat interface
 * - Connection status
 */

import { createEffect, createSignal, For, onMount, Show } from "solid-js";
import { RECOMMENDED_MODELS, useLocalAi } from "./LocalAiProvider";

interface LocalAiPanelProps {
  onInsertCode?: (code: string) => void;
  selectedCode?: string;
}

export function LocalAiPanel(props: LocalAiPanelProps) {
  const localAi = useLocalAi();
  const [input, setInput] = createSignal("");
  const [messages, setMessages] = createSignal<{ role: "user" | "assistant"; content: string }[]>(
    []
  );
  const [streamingContent, setStreamingContent] = createSignal("");
  const [showSettings, setShowSettings] = createSignal(false);
  const [showModelManager, setShowModelManager] = createSignal(false);
  const [urlInput, setUrlInput] = createSignal(localAi.state.ollamaUrl);
  const [pullModelName, setPullModelName] = createSignal("");

  let messagesEndRef: HTMLDivElement | undefined;

  onMount(async () => {
    await localAi.checkConnection();
    if (localAi.state.isConnected) {
      await localAi.listModels();
    }
  });

  createEffect(() => {
    if (messages().length > 0 && messagesEndRef) {
      messagesEndRef.scrollIntoView({ behavior: "smooth" });
    }
  });

  const handleSend = async () => {
    const message = input().trim();
    if (!message || localAi.state.isLoading) return;

    let fullMessage = message;
    if (props.selectedCode) {
      fullMessage = `Regarding this code:\n\`\`\`\n${props.selectedCode}\n\`\`\`\n\n${message}`;
    }

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: fullMessage }]);
    setStreamingContent("");

    try {
      const allMessages = [...messages(), { role: "user" as const, content: fullMessage }];

      const response = await localAi.chatStream(
        allMessages,
        "You are a helpful coding assistant. Provide concise, high-quality responses.",
        (chunk) => {
          setStreamingContent((prev) => prev + chunk);
        }
      );

      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
      setStreamingContent("");
    } catch (e) {
      console.error("Chat failed:", e);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSaveUrl = async () => {
    localAi.setOllamaUrl(urlInput());
    await localAi.checkConnection();
    if (localAi.state.isConnected) {
      await localAi.listModels();
    }
    setShowSettings(false);
  };

  const handlePullModel = async (modelName: string) => {
    try {
      await localAi.pullModel(modelName);
    } catch (e) {
      console.error("Pull failed:", e);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (confirm(`Delete model "${modelName}"?`)) {
      try {
        await localAi.deleteModel(modelName);
      } catch (e) {
        console.error("Delete failed:", e);
      }
    }
  };

  const formatSize = (bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(gb * 1024).toFixed(0)} MB`;
  };

  const renderCodeBlock = (content: string) => {
    const parts: {
      type: "text" | "code";
      content: string;
      language?: string;
    }[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: content.slice(lastIndex, match.index),
        });
      }
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
                    class="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 bg-green-600/20 hover:bg-green-600/30 rounded text-green-400"
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
              <p class="text-text-secondary whitespace-pre-wrap">{part.content}</p>
            )
          }
        </For>
      </div>
    );
  };

  return (
    <div class="local-ai-panel h-full flex flex-col bg-bg-primary">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-text-primary">Local AI</span>
          <div
            class={`w-2 h-2 rounded-full ${
              localAi.state.isConnected ? "bg-green-500" : "bg-red-500"
            }`}
            title={localAi.state.isConnected ? "Connected" : "Disconnected"}
          />
          <Show when={localAi.state.isLoading}>
            <div class="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </Show>
        </div>
        <div class="flex items-center gap-2">
          <select
            class="px-2 py-1 text-xs bg-bg-secondary border border-border rounded text-text-primary focus:outline-none focus:border-green-500"
            value={localAi.state.selectedModel}
            onChange={(e) => localAi.selectModel(e.currentTarget.value)}
            disabled={localAi.state.availableModels.length === 0}
          >
            <For each={localAi.state.availableModels}>
              {(model) => <option value={model.name}>{model.name}</option>}
            </For>
            <Show when={localAi.state.availableModels.length === 0}>
              <option value="">No models</option>
            </Show>
          </select>
          <button
            class="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            onClick={() => setShowModelManager(!showModelManager())}
            title="Model Manager"
          >
            📦
          </button>
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
            <label class="block text-xs text-text-tertiary mb-1">Ollama URL</label>
            <div class="flex gap-2">
              <input
                type="text"
                class="flex-1 px-2 py-1 text-sm bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:border-green-500"
                placeholder="http://localhost:11434"
                value={urlInput()}
                onInput={(e) => setUrlInput(e.currentTarget.value)}
              />
              <button
                class="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                onClick={handleSaveUrl}
              >
                Save
              </button>
            </div>
            <p class="text-[10px] text-text-quaternary mt-1">
              Make sure Ollama is running locally. Install from{" "}
              <a
                href="https://ollama.ai"
                target="_blank"
                class="text-green-400 hover:underline"
                rel="noopener"
              >
                ollama.ai
              </a>
            </p>
          </div>
        </div>
      </Show>

      {/* Model Manager */}
      <Show when={showModelManager()}>
        <div class="p-3 border-b border-border bg-bg-secondary space-y-3 max-h-64 overflow-y-auto">
          <div class="text-xs font-medium text-text-primary">Installed Models</div>
          <Show
            when={localAi.state.availableModels.length > 0}
            fallback={
              <p class="text-xs text-text-tertiary">No models installed. Pull a model below.</p>
            }
          >
            <div class="space-y-1">
              <For each={localAi.state.availableModels}>
                {(model) => (
                  <div class="flex items-center justify-between py-1 px-2 bg-bg-tertiary rounded">
                    <div>
                      <div class="text-sm text-text-primary">{model.name}</div>
                      <div class="text-[10px] text-text-tertiary">{formatSize(model.size)}</div>
                    </div>
                    <button
                      class="text-xs text-red-400 hover:text-red-300"
                      onClick={() => handleDeleteModel(model.name)}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <div class="pt-2 border-t border-border">
            <div class="text-xs font-medium text-text-primary mb-2">Recommended Models</div>
            <div class="space-y-1">
              <For each={RECOMMENDED_MODELS}>
                {(model) => {
                  const isInstalled = localAi.state.availableModels.some(
                    (m) => m.name === model.name
                  );
                  return (
                    <div class="flex items-center justify-between py-1 px-2 bg-bg-tertiary/50 rounded">
                      <div>
                        <div class="text-sm text-text-primary">{model.displayName}</div>
                        <div class="text-[10px] text-text-tertiary">
                          {model.size} • {model.description}
                        </div>
                      </div>
                      <Show
                        when={!isInstalled}
                        fallback={<span class="text-xs text-green-400">Installed</span>}
                      >
                        <button
                          class="text-xs text-green-400 hover:text-green-300"
                          onClick={() => handlePullModel(model.name)}
                          disabled={!!localAi.state.pullProgress}
                        >
                          Pull
                        </button>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Custom pull */}
          <div class="pt-2 border-t border-border">
            <div class="text-xs font-medium text-text-primary mb-1">Pull Custom Model</div>
            <div class="flex gap-2">
              <input
                type="text"
                class="flex-1 px-2 py-1 text-xs bg-bg-primary border border-border rounded text-text-primary"
                placeholder="e.g., llama3.2:7b"
                value={pullModelName()}
                onInput={(e) => setPullModelName(e.currentTarget.value)}
              />
              <button
                class="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded"
                onClick={() => handlePullModel(pullModelName())}
                disabled={!pullModelName() || !!localAi.state.pullProgress}
              >
                Pull
              </button>
            </div>
          </div>

          {/* Pull progress */}
          <Show when={localAi.state.pullProgress}>
            <div class="p-2 bg-bg-tertiary rounded">
              <div class="text-xs text-text-primary mb-1">
                Pulling {localAi.state.pullProgress?.model}...
              </div>
              <div class="text-[10px] text-text-tertiary mb-1">
                {localAi.state.pullProgress?.status}
              </div>
              <div class="w-full h-1 bg-bg-secondary rounded overflow-hidden">
                <div
                  class="h-full bg-green-500 transition-all duration-300"
                  style={{
                    width: `${
                      localAi.state.pullProgress?.total
                        ? (
                            localAi.state.pullProgress.completed / localAi.state.pullProgress.total
                          ) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          </Show>
        </div>
      </Show>

      {/* Not Connected Warning */}
      <Show when={!localAi.state.isConnected}>
        <div class="p-3 bg-yellow-900/20 border-b border-yellow-700/50 text-yellow-300 text-sm">
          <p>
            ⚠️ Cannot connect to Ollama at {localAi.state.ollamaUrl}. Make sure Ollama is running.
          </p>
          <button
            class="mt-1 text-xs underline hover:no-underline"
            onClick={() => localAi.checkConnection()}
          >
            Retry connection
          </button>
        </div>
      </Show>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-3 space-y-4">
        <Show when={messages().length === 0 && !streamingContent()}>
          <div class="text-center py-8">
            <div class="text-4xl mb-2">🖥️</div>
            <h3 class="text-lg font-medium text-text-primary mb-1">Local AI</h3>
            <p class="text-sm text-text-tertiary max-w-xs mx-auto">
              Chat with local AI models running on your machine. No API keys, no cloud, completely
              private.
            </p>
            <Show when={props.selectedCode}>
              <p class="text-xs text-green-400 mt-2">
                Code selected - I'll include it in your message.
              </p>
            </Show>
          </div>
        </Show>

        <For each={messages()}>
          {(message) => (
            <div class={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                class={`max-w-[85%] rounded-lg px-3 py-2 ${
                  message.role === "user"
                    ? "bg-green-600 text-white"
                    : "bg-bg-secondary text-text-primary"
                }`}
              >
                {message.role === "assistant" ? (
                  renderCodeBlock(message.content)
                ) : (
                  <p class="text-sm whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          )}
        </For>

        {/* Streaming response */}
        <Show when={streamingContent()}>
          <div class="flex justify-start">
            <div class="max-w-[85%] rounded-lg px-3 py-2 bg-bg-secondary text-text-primary">
              {renderCodeBlock(streamingContent())}
            </div>
          </div>
        </Show>

        {/* Error Display */}
        <Show when={localAi.state.error}>
          <div class="p-3 bg-red-900/30 border border-red-700/50 rounded text-red-300 text-sm">
            {localAi.state.error}
          </div>
        </Show>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div class="p-3 border-t border-border">
        <Show when={props.selectedCode}>
          <div class="mb-2 px-2 py-1 bg-green-600/10 border border-green-600/30 rounded text-xs text-green-400">
            📎 Code attached ({props.selectedCode?.split("\n").length ?? 0} lines)
          </div>
        </Show>

        <div class="flex gap-2">
          <textarea
            class="flex-1 px-3 py-2 text-sm bg-bg-secondary border border-border rounded resize-none text-text-primary placeholder-text-tertiary focus:outline-none focus:border-green-500"
            placeholder="Ask me anything..."
            rows={2}
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            disabled={localAi.state.isLoading || !localAi.state.isConnected}
          />
          <button
            class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleSend}
            disabled={localAi.state.isLoading || !input().trim() || !localAi.state.isConnected}
          >
            Send
          </button>
        </div>

        <div class="flex items-center justify-between mt-2 text-[10px] text-text-quaternary">
          <span>Press Enter to send, Shift+Enter for new line</span>
          <button
            class="hover:text-text-tertiary transition-colors"
            onClick={() => setMessages([])}
          >
            Clear chat
          </button>
        </div>
      </div>
    </div>
  );
}
