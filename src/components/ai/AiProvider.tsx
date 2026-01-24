/**
 * AI Provider and Context
 *
 * Provides AI capabilities to the application:
 * - OpenRouter API integration
 * - Multiple model support
 * - Conversation history
 * - Token usage tracking
 */

import { createContext, type ParentComponent, useContext } from "solid-js";
import { createStore } from "solid-js/store";

// AI Model definitions
export interface AiModel {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

// Available models via OpenRouter
export const AI_MODELS: AiModel[] = [
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
  },
  {
    id: "anthropic/claude-3-haiku",
    name: "Claude 3 Haiku",
    provider: "Anthropic",
    contextWindow: 200000,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
  },
  {
    id: "openai/gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    contextWindow: 128000,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    contextWindow: 128000,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
  },
  {
    id: "google/gemini-pro-1.5",
    name: "Gemini Pro 1.5",
    provider: "Google",
    contextWindow: 1000000,
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
  },
  {
    id: "meta-llama/llama-3.1-70b-instruct",
    name: "Llama 3.1 70B",
    provider: "Meta",
    contextWindow: 131072,
    costPer1kInput: 0.00059,
    costPer1kOutput: 0.00079,
  },
];

// Message types
export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp: number;
}

// AI request options
export interface AiRequestOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
}

// Usage tracking
export interface AiUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// AI Context state
interface AiState {
  apiKey: string | null;
  selectedModel: string;
  isLoading: boolean;
  error: string | null;
  messages: AiMessage[];
  usage: AiUsage;
}

// AI Context type
interface AiContextType {
  state: AiState;
  setApiKey: (key: string) => void;
  selectModel: (modelId: string) => void;
  sendMessage: (message: string, options?: AiRequestOptions) => Promise<string>;
  streamMessage: (
    message: string,
    options?: AiRequestOptions,
    onChunk?: (chunk: string) => void
  ) => Promise<string>;
  clearHistory: () => void;
  getCodeSuggestion: (code: string, instruction: string) => Promise<string>;
  explainCode: (code: string) => Promise<string>;
  generateCode: (description: string, language: string) => Promise<string>;
  fixError: (code: string, error: string) => Promise<string>;
}

const AiContext = createContext<AiContextType>();

export const AiProvider: ParentComponent = (props) => {
  const [state, setState] = createStore<AiState>({
    apiKey: localStorage.getItem("ferrum_openrouter_key"),
    selectedModel: "anthropic/claude-3.5-sonnet",
    isLoading: false,
    error: null,
    messages: [],
    usage: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
  });

  const setApiKey = (key: string) => {
    localStorage.setItem("ferrum_openrouter_key", key);
    setState("apiKey", key);
  };

  const selectModel = (modelId: string) => {
    setState("selectedModel", modelId);
  };

  const clearHistory = () => {
    setState("messages", []);
  };

  const callOpenRouter = async (
    messages: AiMessage[],
    options: AiRequestOptions = {}
  ): Promise<{ content: string; usage: AiUsage }> => {
    if (!state.apiKey) {
      throw new Error("OpenRouter API key not set");
    }

    const model = options.model || state.selectedModel;
    const modelInfo = AI_MODELS.find((m) => m.id === model) || AI_MODELS[0];

    const requestMessages = options.systemPrompt
      ? [{ role: "system" as const, content: options.systemPrompt }, ...messages]
      : messages;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.apiKey}`,
        "HTTP-Referer": "https://ferrum.ide",
        "X-Title": "Ferrum IDE",
      },
      body: JSON.stringify({
        model,
        messages: requestMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stream: options.stream ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || "Failed to call OpenRouter API");
    }

    const data = await response.json();

    const usage: AiUsage = {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
      estimatedCost:
        ((data.usage?.prompt_tokens || 0) * (modelInfo?.costPer1kInput ?? 0) +
          (data.usage?.completion_tokens || 0) * (modelInfo?.costPer1kOutput ?? 0)) /
        1000,
    };

    return {
      content: data.choices[0]?.message?.content || "",
      usage,
    };
  };

  const sendMessage = async (message: string, options: AiRequestOptions = {}): Promise<string> => {
    setState("isLoading", true);
    setState("error", null);

    try {
      const userMessage: AiMessage = {
        role: "user",
        content: message,
        timestamp: Date.now(),
      };

      const newMessages = [...state.messages, userMessage];
      setState("messages", newMessages);

      const { content, usage } = await callOpenRouter(newMessages, options);

      const assistantMessage: AiMessage = {
        role: "assistant",
        content,
        timestamp: Date.now(),
      };

      setState("messages", [...newMessages, assistantMessage]);
      setState("usage", (prev) => ({
        promptTokens: prev.promptTokens + usage.promptTokens,
        completionTokens: prev.completionTokens + usage.completionTokens,
        totalTokens: prev.totalTokens + usage.totalTokens,
        estimatedCost: prev.estimatedCost + usage.estimatedCost,
      }));

      return content;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unknown error";
      setState("error", errorMsg);
      throw e;
    } finally {
      setState("isLoading", false);
    }
  };

  const streamMessage = async (
    message: string,
    options: AiRequestOptions = {},
    _onChunk?: (chunk: string) => void
  ): Promise<string> => {
    // For now, just use non-streaming
    // Full streaming implementation would require SSE handling
    return sendMessage(message, options);
  };

  // Convenience methods for common AI tasks
  const getCodeSuggestion = async (code: string, instruction: string): Promise<string> => {
    const prompt = `Given the following code:

\`\`\`
${code}
\`\`\`

${instruction}

Provide only the modified code without explanations.`;

    return sendMessage(prompt, {
      systemPrompt:
        "You are a helpful coding assistant. Provide concise, high-quality code modifications.",
      temperature: 0.3,
    });
  };

  const explainCode = async (code: string): Promise<string> => {
    const prompt = `Explain the following code in detail:

\`\`\`
${code}
\`\`\`

Provide a clear, concise explanation of what this code does, including:
1. Purpose
2. Key concepts used
3. Step-by-step breakdown
4. Potential improvements (if any)`;

    return sendMessage(prompt, {
      systemPrompt: "You are a helpful coding tutor. Explain code clearly and thoroughly.",
      temperature: 0.5,
    });
  };

  const generateCode = async (description: string, language: string): Promise<string> => {
    const prompt = `Generate ${language} code for the following:

${description}

Provide clean, well-commented code.`;

    return sendMessage(prompt, {
      systemPrompt: `You are an expert ${language} developer. Generate clean, efficient, and well-documented code.`,
      temperature: 0.5,
    });
  };

  const fixError = async (code: string, error: string): Promise<string> => {
    const prompt = `The following code has an error:

\`\`\`
${code}
\`\`\`

Error message:
${error}

Provide the corrected code and a brief explanation of the fix.`;

    return sendMessage(prompt, {
      systemPrompt:
        "You are a debugging expert. Fix code errors efficiently and explain the solution.",
      temperature: 0.3,
    });
  };

  const contextValue: AiContextType = {
    state,
    setApiKey,
    selectModel,
    sendMessage,
    streamMessage,
    clearHistory,
    getCodeSuggestion,
    explainCode,
    generateCode,
    fixError,
  };

  return <AiContext.Provider value={contextValue}>{props.children}</AiContext.Provider>;
};

export const useAi = () => {
  const context = useContext(AiContext);
  if (!context) {
    throw new Error("useAi must be used within an AiProvider");
  }
  return context;
};
