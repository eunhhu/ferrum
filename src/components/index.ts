/**
 * Ferrum IDE Components
 *
 * Central export point for all UI components.
 * Organized by feature area for easy discovery.
 */

// ============================================================================
// Layout Components
// ============================================================================
export { ActivityBar } from "./layout/ActivityBar";
export { EditorArea } from "./layout/EditorArea";
export { Panel } from "./layout/Panel";
export { Sidebar } from "./layout/Sidebar";
export { StatusBar } from "./layout/StatusBar";

// ============================================================================
// Editor Components
// ============================================================================
export { Editor } from "./editor/Editor";
export { EditorTabs } from "./editor/EditorTabs";
export { EditorWithFeatures } from "./editor/EditorWithFeatures";
export { Autocomplete } from "./editor/Autocomplete";
export { HoverTooltip } from "./editor/HoverTooltip";
export { NavigationTrail } from "./editor/NavigationTrail";
export { PeekView } from "./editor/PeekView";
export { ContextActionPalette } from "./editor/ContextActionPalette";
export { ViewModeToggle } from "./editor/ViewModeToggle";
export { StructuralMinimap } from "./editor/StructuralMinimap";
export { DependencyHighlight } from "./editor/DependencyHighlight";
export { InlineBlame } from "./editor/InlineBlame";
export { useComponentify } from "./editor/Componentify";
export { ErrorFlowVisualization } from "./editor/ErrorFlowVisualization";

// ============================================================================
// Tree Viewer Components
// ============================================================================
export { TreeViewer } from "./tree-viewer/TreeViewer";
export { StickyHeader } from "./tree-viewer/StickyHeader";

// ============================================================================
// Visual Coding Components
// ============================================================================
export { VisualCodeView } from "./visual/VisualCodeView";

// ============================================================================
// Preview Components
// ============================================================================
export { CompilePreview } from "./preview/CompilePreview";

// ============================================================================
// AI Components
// ============================================================================
export { AiProvider } from "./ai/AiProvider";
export { LocalAiProvider } from "./ai/LocalAiProvider";
export { CombinedAiProvider } from "./ai/CombinedAiProvider";
export { AiChatPanel } from "./ai/AiChatPanel";
export { LocalAiPanel } from "./ai/LocalAiPanel";
export { UnifiedAiPanel } from "./ai/UnifiedAiPanel";
export { AiContextActions } from "./ai/AiContextActions";

// ============================================================================
// Panel Components
// ============================================================================
export { ProblemsPanel } from "./panels/ProblemsPanel";
export { EnvManagerPanel } from "./panels/EnvManagerPanel";

// ============================================================================
// Explorer Components
// ============================================================================
export { FileExplorer } from "./explorer/FileExplorer";

// ============================================================================
// Terminal Components
// ============================================================================
export { Terminal } from "./terminal/Terminal";
export { TerminalPanel } from "./terminal/TerminalPanel";

// ============================================================================
// Search Components
// ============================================================================
export { SearchPanel } from "./search/SearchPanel";

// ============================================================================
// Git Components
// ============================================================================
export { GitPanel } from "./git/GitPanel";

// ============================================================================
// Settings Components
// ============================================================================
export { SettingsPanel } from "./settings/SettingsPanel";

// ============================================================================
// UI Components
// ============================================================================
export { CommandPalette } from "./ui/CommandPalette";
