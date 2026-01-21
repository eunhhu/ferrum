/**
 * Local AI Provider
 *
 * Provides local AI capabilities using Ollama.
 * Features:
 * - Ollama integration for offline AI
 * - Multiple local model support
 * - Streaming responses
 * - Model management (list, pull, delete)
 */

import { createContext, useContext, ParentComponent } from "solid-js";
import { createStore } from "solid-js/store";

// Local model definitions
export interface LocalModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
  details?: {
    format: string;
    family: string;
    parameterSize: string;
    quantizationLevel: string;
  };
}

// Recommended models for code tasks
export const RECOMMENDED_MODELS = [
  {
    name: "codellama:7b",
    displayName: "CodeLlama 7B",
    description: "Meta's code-focused model, good balance of speed and quality",
    size: "3.8 GB",
  },
  {
    name: "codellama:13b",
    displayName: "CodeLlama 13B",
    description: "Larger CodeLlama for better code understanding",
    size: "7.4 GB",
  },
  {
    name: "deepseek-coder:6.7b",
    displayName: "DeepSeek Coder 6.7B",
    description: "Specialized code model with excellent performance",
    size: "3.8 GB",
  },
  {
    name: "qwen2.5-coder:7b",
    displayName: "Qwen 2.5 Coder 7B",
    description: "Alibaba's powerful code model",
    size: "4.7 GB",
  },
  {
    name: "llama3.2:3b",
    displayName: "Llama 3.2 3B",
    description: "Fast general-purpose model for quick tasks",
    size: "2.0 GB",
  },
  {
    name: "mistral:7b",
    displayName: "Mistral 7B",
    description: "General-purpose model with good reasoning",
    size: "4.1 GB",
  },
];

// Message type
export interface LocalAiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Local AI state
interface LocalAiState {
  ollamaUrl: string;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  availableModels: LocalModel[];
  selectedModel: string;
  pullProgress: {
    model: string;
    status: string;
    completed: number;
    total: number;
  } | null;
}

// Local AI context type
interface LocalAiContextType {
  state: LocalAiState;
  setOllamaUrl: (url: string) => void;
  checkConnection: () => Promise<boolean>;
  listModels: () => Promise<LocalModel[]>;
  selectModel: (name: string) => void;
  pullModel: (
    name: string,
    onProgress?: (progress: number) => void
  ) => Promise<void>;
  deleteModel: (name: string) => Promise<void>;
  generate: (prompt: string, systemPrompt?: string) => Promise<string>;
  generateStream: (
    prompt: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void
  ) => Promise<string>;
  chat: (messages: LocalAiMessage[], systemPrompt?: string) => Promise<string>;
  chatStream: (
    messages: LocalAiMessage[],
    systemPrompt?: string,
    onChunk?: (chunk: string) => void
  ) => Promise<string>;
}

const LocalAiContext = createContext<LocalAiContextType>();

export const LocalAiProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<LocalAiState>({
    ollamaUrl:
      localStorage.getItem("ferrum_ollama_url") || "http://localhost:11434",
    isConnected: false,
    isLoading: false,
    error: null,
    availableModels: [],
    selectedModel: localStorage.getItem("ferrum_local_model") || "codellama:7b",
    pullProgress: null,
  });

  const setOllamaUrl = (url: string) => {
    localStorage.setItem("ferrum_ollama_url", url);
    setState("ollamaUrl", url);
    setState("isConnected", false);
  };

  const selectModel = (name: string) => {
    localStorage.setItem("ferrum_local_model", name);
    setState("selectedModel", name);
  };

  const checkConnection = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${state.ollamaUrl}/api/tags`);
      if (response.ok) {
        setState("isConnected", true);
        setState("error", null);
        return true;
      }
      setState("isConnected", false);
      setState("error", "Ollama server not responding");
      return false;
    } catch (e) {
      setState("isConnected", false);
      setState("error", "Cannot connect to Ollama. Is it running?");
      return false;
    }
  };

  const listModels = async (): Promise<LocalModel[]> => {
    try {
      const response = await fetch(`${state.ollamaUrl}/api/tags`);
      if (!response.ok) {
        throw new Error("Failed to list models");
      }
      const data = await response.json();
      const models = data.models || [];
      setState("availableModels", models);
      setState("isConnected", true);
      return models;
    } catch (e) {
      setState(
        "error",
        e instanceof Error ? e.message : "Failed to list models"
      );
      return [];
    }
  };

  const pullModel = async (
    name: string,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    setState("pullProgress", {
      model: name,
      status: "starting",
      completed: 0,
      total: 0,
    });

    try {
      const response = await fetch(`${state.ollamaUrl}/api/pull`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, stream: true }),
      });

      if (!response.ok) {
        throw new Error("Failed to pull model");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.total && data.completed) {
              const progress = (data.completed / data.total) * 100;
              setState("pullProgress", {
                model: name,
                status: data.status || "downloading",
                completed: data.completed,
                total: data.total,
              });
              onProgress?.(progress);
            } else if (data.status) {
              setState("pullProgress", (prev) =>
                prev ? { ...prev, status: data.status } : null
              );
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      setState("pullProgress", null);
      await listModels();
    } catch (e) {
      setState("pullProgress", null);
      throw e;
    }
  };

  const deleteModel = async (name: string): Promise<void> => {
    const response = await fetch(`${state.ollamaUrl}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error("Failed to delete model");
    }

    await listModels();
  };

  const generate = async (
    prompt: string,
    systemPrompt?: string
  ): Promise<string> => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const response = await fetch(`${state.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: state.selectedModel,
          prompt,
          system: systemPrompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate response");
      }

      const data = await response.json();
      return data.response || "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setState("error", msg);
      throw e;
    } finally {
      setState("isLoading", false);
    }
  };

  const generateStream = async (
    prompt: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const response = await fetch(`${state.ollamaUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: state.selectedModel,
          prompt,
          system: systemPrompt,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              fullResponse += data.response;
              onChunk?.(data.response);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      return fullResponse;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      setState("error", msg);
      throw e;
    } finally {
      setState("isLoading", false);
    }
  };

  const chat = async (
    messages: LocalAiMessage[],
    systemPrompt?: string
  ): Promise<string> => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const allMessages = systemPrompt
        ? [{ role: "system" as const, content: systemPrompt }, ...messages]
        : messages;

      const response = await fetch(`${state.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: state.selectedModel,
          messages: allMessages,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to chat");
      }

      const data = await response.json();
      return data.message?.content || "";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat failed";
      setState("error", msg);
      throw e;
    } finally {
      setState("isLoading", false);
    }
  };

  const chatStream = async (
    messages: LocalAiMessage[],
    systemPrompt?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const allMessages = systemPrompt
        ? [{ role: "system" as const, content: systemPrompt }, ...messages]
        : messages;

      const response = await fetch(`${state.ollamaUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: state.selectedModel,
          messages: allMessages,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to chat");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullResponse += data.message.content;
              onChunk?.(data.message.content);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      return fullResponse;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Chat failed";
      setState("error", msg);
      throw e;
    } finally {
      setState("isLoading", false);
    }
  };

  const contextValue: LocalAiContextType = {
    state,
    setOllamaUrl,
    checkConnection,
    listModels,
    selectModel,
    pullModel,
    deleteModel,
    generate,
    generateStream,
    chat,
    chatStream,
  };

  return (
    <LocalAiContext.Provider value={contextValue}>
      {props.children}
    </LocalAiContext.Provider>
  );
};

export const useLocalAi = () => {
  const context = useContext(LocalAiContext);
  if (!context) {
    throw new Error("useLocalAi must be used within a LocalAiProvider");
  }
  return context;
};
