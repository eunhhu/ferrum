/**
 * AI Components Module
 *
 * Exports all AI-related components and providers.
 */

// UI Components
export { AiChatPanel } from "./AiChatPanel";
export type { AiAction } from "./AiContextActions";
export { AiContextActions } from "./AiContextActions";
export type {
  AiMessage,
  AiModel,
  AiRequestOptions,
  AiUsage,
} from "./AiProvider";
// OpenRouter (Cloud) AI
export { AI_MODELS, AiProvider, useAi } from "./AiProvider";
export type { AiMode } from "./CombinedAiProvider";
// Combined Provider
export { CombinedAiProvider, useAiHub } from "./CombinedAiProvider";
export { LocalAiPanel } from "./LocalAiPanel";
export type { LocalAiMessage, LocalModel } from "./LocalAiProvider";
// Local AI (Ollama)
export {
  LocalAiProvider,
  RECOMMENDED_MODELS,
  useLocalAi,
} from "./LocalAiProvider";
export type { AiPanelMode } from "./UnifiedAiPanel";
export { UnifiedAiPanel } from "./UnifiedAiPanel";
