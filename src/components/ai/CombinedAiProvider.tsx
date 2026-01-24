/**
 * Combined AI Provider
 *
 * Combines both OpenRouter (cloud) and Ollama (local) AI providers
 * into a unified interface that can switch between them.
 */

import { createContext, createSignal, type ParentComponent, useContext } from "solid-js";
import { AiProvider, useAi } from "./AiProvider";
import { LocalAiProvider, useLocalAi } from "./LocalAiProvider";

export type AiMode = "cloud" | "local";

interface AiHubContextType {
  mode: () => AiMode;
  setMode: (mode: AiMode) => void;
  isAvailable: () => boolean;
  sendMessage: (message: string, systemPrompt?: string) => Promise<string>;
  streamMessage: (
    message: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void
  ) => Promise<string>;
  getCodeSuggestion: (code: string, instruction: string) => Promise<string>;
  explainCode: (code: string) => Promise<string>;
  fixError: (code: string, error: string) => Promise<string>;
  isLoading: () => boolean;
  error: () => string | null;
}

const AiHubContext = createContext<AiHubContextType>();

function AiHubProviderInner(props: { children: any }) {
  const cloudAi = useAi();
  const localAi = useLocalAi();

  const [mode, setModeInternal] = createSignal<AiMode>(
    (localStorage.getItem("ferrum_ai_mode") as AiMode) || "cloud"
  );

  const setMode = (newMode: AiMode) => {
    localStorage.setItem("ferrum_ai_mode", newMode);
    setModeInternal(newMode);
  };

  const isAvailable = () => {
    if (mode() === "cloud") {
      return !!cloudAi.state.apiKey;
    }
    return localAi.state.isConnected && localAi.state.availableModels.length > 0;
  };

  const sendMessage = async (message: string, systemPrompt?: string): Promise<string> => {
    if (mode() === "cloud") {
      return cloudAi.sendMessage(message, systemPrompt ? { systemPrompt } : {});
    }
    return localAi.chat([{ role: "user", content: message }], systemPrompt);
  };

  const streamMessage = async (
    message: string,
    systemPrompt?: string,
    onChunk?: (chunk: string) => void
  ): Promise<string> => {
    if (mode() === "cloud") {
      // Cloud streaming - for now use non-streaming
      return cloudAi.sendMessage(message, systemPrompt ? { systemPrompt } : {});
    }
    return localAi.chatStream([{ role: "user", content: message }], systemPrompt, onChunk);
  };

  const getCodeSuggestion = async (code: string, instruction: string): Promise<string> => {
    const prompt = `Given the following code:

\`\`\`
${code}
\`\`\`

${instruction}

Provide only the modified code without explanations.`;

    const systemPrompt =
      "You are a helpful coding assistant. Provide concise, high-quality code modifications.";

    if (mode() === "cloud") {
      return cloudAi.sendMessage(prompt, { systemPrompt, temperature: 0.3 });
    }
    return localAi.chat([{ role: "user", content: prompt }], systemPrompt);
  };

  const explainCode = async (code: string): Promise<string> => {
    const prompt = `Explain the following code in detail:

\`\`\`
${code}
\`\`\`

Provide a clear, concise explanation of what this code does, including:
1. Purpose
2. Key concepts used
3. Step-by-step breakdown`;

    const systemPrompt = "You are a helpful coding tutor. Explain code clearly and thoroughly.";

    if (mode() === "cloud") {
      return cloudAi.sendMessage(prompt, { systemPrompt, temperature: 0.5 });
    }
    return localAi.chat([{ role: "user", content: prompt }], systemPrompt);
  };

  const fixError = async (code: string, error: string): Promise<string> => {
    const prompt = `The following code has an error:

\`\`\`
${code}
\`\`\`

Error message:
${error}

Provide the corrected code and a brief explanation of the fix.`;

    const systemPrompt =
      "You are a debugging expert. Fix code errors efficiently and explain the solution.";

    if (mode() === "cloud") {
      return cloudAi.sendMessage(prompt, { systemPrompt, temperature: 0.3 });
    }
    return localAi.chat([{ role: "user", content: prompt }], systemPrompt);
  };

  const isLoading = () => {
    return mode() === "cloud" ? cloudAi.state.isLoading : localAi.state.isLoading;
  };

  const error = () => {
    return mode() === "cloud" ? cloudAi.state.error : localAi.state.error;
  };

  const contextValue: AiHubContextType = {
    mode,
    setMode,
    isAvailable,
    sendMessage,
    streamMessage,
    getCodeSuggestion,
    explainCode,
    fixError,
    isLoading,
    error,
  };

  return <AiHubContext.Provider value={contextValue}>{props.children}</AiHubContext.Provider>;
}

export const CombinedAiProvider: ParentComponent = (props) => {
  return (
    <AiProvider>
      <LocalAiProvider>
        <AiHubProviderInner>{props.children}</AiHubProviderInner>
      </LocalAiProvider>
    </AiProvider>
  );
};

export const useAiHub = () => {
  const context = useContext(AiHubContext);
  if (!context) {
    throw new Error("useAiHub must be used within a CombinedAiProvider");
  }
  return context;
};
