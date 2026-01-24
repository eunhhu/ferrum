/**
 * Ferrum IDE Components
 *
 * Central export point for all UI components.
 * Organized by feature area for easy discovery.
 */

export { AiChatPanel } from "./ai/AiChatPanel";
export { AiContextActions } from "./ai/AiContextActions";
// ============================================================================
// AI Components
// ============================================================================
export { AiProvider } from "./ai/AiProvider";
export { CombinedAiProvider } from "./ai/CombinedAiProvider";
export { LocalAiPanel } from "./ai/LocalAiPanel";
export { LocalAiProvider } from "./ai/LocalAiProvider";
export { UnifiedAiPanel } from "./ai/UnifiedAiPanel";
export { Autocomplete } from "./editor/Autocomplete";
export { useComponentify } from "./editor/Componentify";
export { ContextActionPalette } from "./editor/ContextActionPalette";
export { DependencyHighlight } from "./editor/DependencyHighlight";
// ============================================================================
// Editor Components
// ============================================================================
export { Editor } from "./editor/Editor";
export { EditorTabs } from "./editor/EditorTabs";
export { EditorWithFeatures } from "./editor/EditorWithFeatures";
export { ErrorFlowVisualization } from "./editor/ErrorFlowVisualization";
export { HoverTooltip } from "./editor/HoverTooltip";
export { InlineBlame } from "./editor/InlineBlame";
export { NavigationTrail } from "./editor/NavigationTrail";
export { PeekView } from "./editor/PeekView";
export { StructuralMinimap } from "./editor/StructuralMinimap";
export { ViewModeToggle } from "./editor/ViewModeToggle";
// ============================================================================
// Explorer Components
// ============================================================================
export { FileExplorer } from "./explorer/FileExplorer";
// ============================================================================
// Git Components
// ============================================================================
export { GitPanel } from "./git/GitPanel";
// ============================================================================
// Layout Components
// ============================================================================
export { ActivityBar } from "./layout/ActivityBar";
export { EditorArea } from "./layout/EditorArea";
export { Panel } from "./layout/Panel";
export { Sidebar } from "./layout/Sidebar";
export { StatusBar } from "./layout/StatusBar";
export { EnvManagerPanel } from "./panels/EnvManagerPanel";
// ============================================================================
// Panel Components
// ============================================================================
export { ProblemsPanel } from "./panels/ProblemsPanel";
// ============================================================================
// Preview Components
// ============================================================================
export { CompilePreview } from "./preview/CompilePreview";
// ============================================================================
// Search Components
// ============================================================================
export { SearchPanel } from "./search/SearchPanel";
// ============================================================================
// Settings Components
// ============================================================================
export { SettingsPanel } from "./settings/SettingsPanel";

// ============================================================================
// Terminal Components
// ============================================================================
export { Terminal } from "./terminal/Terminal";
export { TerminalPanel } from "./terminal/TerminalPanel";
export { StickyHeader } from "./tree-viewer/StickyHeader";
// ============================================================================
// Tree Viewer Components
// ============================================================================
export { TreeViewer } from "./tree-viewer/TreeViewer";
// ============================================================================
// UI Components
// ============================================================================
export { CommandPalette } from "./ui/CommandPalette";
// ============================================================================
// Visual Coding Components
// ============================================================================
export { VisualCodeView } from "./visual/VisualCodeView";
