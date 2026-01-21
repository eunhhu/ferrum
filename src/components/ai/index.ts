/**
 * AI Components Module
 *
 * Exports all AI-related components and providers.
 */

// OpenRouter (Cloud) AI
export { AiProvider, useAi, AI_MODELS } from "./AiProvider";
export type {
  AiModel,
  AiMessage,
  AiRequestOptions,
  AiUsage,
} from "./AiProvider";

// Local AI (Ollama)
export {
  LocalAiProvider,
  useLocalAi,
  RECOMMENDED_MODELS,
} from "./LocalAiProvider";
export type { LocalModel, LocalAiMessage } from "./LocalAiProvider";

// UI Components
export { AiChatPanel } from "./AiChatPanel";
export { LocalAiPanel } from "./LocalAiPanel";
export { UnifiedAiPanel } from "./UnifiedAiPanel";
export type { AiPanelMode } from "./UnifiedAiPanel";
export { AiContextActions } from "./AiContextActions";
export type { AiAction } from "./AiContextActions";

// Combined Provider
export { CombinedAiProvider, useAiHub } from "./CombinedAiProvider";
export type { AiMode } from "./CombinedAiProvider";
