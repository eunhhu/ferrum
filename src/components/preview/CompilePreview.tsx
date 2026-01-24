/**
 * Compile-time Preview Component
 *
 * Shows a live preview of React/SolidJS components as you edit.
 * Supports hot reloading and error boundary.
 */

import { createEffect, createSignal, onCleanup, Show } from "solid-js";

interface CompilePreviewProps {
  filePath: string | null;
  code: string;
  language: string;
  enabled: boolean;
  onError?: (error: string) => void;
}

interface PreviewState {
  status: "idle" | "compiling" | "ready" | "error";
  error: string | null;
  lastUpdate: number;
}

export function CompilePreview(props: CompilePreviewProps) {
  const [state, setState] = createSignal<PreviewState>({
    status: "idle",
    error: null,
    lastUpdate: 0,
  });
  const [, setIframeKey] = createSignal(0);

  let iframeRef: HTMLIFrameElement | undefined;
  let debounceTimer: number | undefined;

  // Debounced code update
  createEffect(() => {
    if (!(props.enabled && props.code)) return;

    // Only preview JSX/TSX files
    if (!isPreviewable(props.filePath, props.language)) {
      setState({ status: "idle", error: null, lastUpdate: Date.now() });
      return;
    }

    // Debounce compilation
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    setState((s) => ({ ...s, status: "compiling" }));

    debounceTimer = window.setTimeout(() => {
      compileAndPreview();
    }, 500);
  });

  onCleanup(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  });

  const isPreviewable = (filePath: string | null, language: string): boolean => {
    if (!filePath) return false;
    const ext = filePath.split(".").pop()?.toLowerCase();
    return (
      ext === "tsx" ||
      ext === "jsx" ||
      language === "typescriptreact" ||
      language === "javascriptreact"
    );
  };

  const compileAndPreview = async () => {
    try {
      // Generate preview HTML
      const previewHtml = generatePreviewHtml(props.code, props.filePath);

      // Update iframe
      if (iframeRef) {
        const blob = new Blob([previewHtml], { type: "text/html" });
        const url = URL.createObjectURL(blob);

        // Force iframe refresh
        setIframeKey((k) => k + 1);

        // Clean up old URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        iframeRef.src = url;
      }

      setState({
        status: "ready",
        error: null,
        lastUpdate: Date.now(),
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Compilation failed";
      setState({
        status: "error",
        error: errorMsg,
        lastUpdate: Date.now(),
      });
      props.onError?.(errorMsg);
    }
  };

  const generatePreviewHtml = (code: string, filePath: string | null): string => {
    // Extract component name from file path
    const componentName = filePath
      ? filePath
          .split("/")
          .pop()
          ?.replace(/\.(tsx|jsx)$/, "") || "Component"
      : "Component";

    // Simple transformation for preview (in production, use proper bundler)
    const transformedCode = transformForPreview(code, componentName);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; }
    body { 
      margin: 0; 
      padding: 16px; 
      font-family: system-ui, -apple-system, sans-serif;
      background: #1a1a1a;
      color: #e5e5e5;
      min-height: 100vh;
    }
    #root { min-height: 100%; }
    .preview-error {
      background: #7f1d1d;
      border: 1px solid #dc2626;
      border-radius: 8px;
      padding: 16px;
      color: #fecaca;
      font-family: monospace;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react,typescript">
    ${transformedCode}
    
    // Error boundary
    class ErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
      }
      static getDerivedStateFromError(error) {
        return { hasError: true, error };
      }
      render() {
        if (this.state.hasError) {
          return React.createElement('div', { className: 'preview-error' },
            'Preview Error:\\n' + (this.state.error?.message || 'Unknown error')
          );
        }
        return this.props.children;
      }
    }
    
    // Render
    try {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(
        React.createElement(ErrorBoundary, null,
          React.createElement(${componentName}, null)
        )
      );
    } catch (e) {
      document.getElementById('root').innerHTML = 
        '<div class="preview-error">Render Error:\\n' + e.message + '</div>';
    }
  </script>
</body>
</html>`;
  };

  const transformForPreview = (code: string, componentName: string): string => {
    // Remove imports (they'll be provided by CDN)
    let transformed = code
      .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, "")
      .replace(/^import\s+['"].*?['"];?\s*$/gm, "")
      .replace(/^export\s+default\s+/gm, "const " + componentName + " = ")
      .replace(/^export\s+/gm, "");

    // Handle function component exports
    if (!transformed.includes(`const ${componentName}`)) {
      transformed = transformed.replace(
        new RegExp(`^(function\\s+${componentName})`, "m"),
        `const ${componentName} = function`
      );
    }

    return transformed;
  };

  const getStatusColor = (): string => {
    switch (state().status) {
      case "compiling":
        return "bg-yellow-500";
      case "ready":
        return "bg-green-500";
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (): string => {
    switch (state().status) {
      case "compiling":
        return "Compiling...";
      case "ready":
        return "Ready";
      case "error":
        return "Error";
      default:
        return "Idle";
    }
  };

  return (
    <div class="compile-preview flex flex-col h-full bg-bg-secondary">
      {/* Header */}
      <div class="flex items-center justify-between px-3 py-2 border-b border-border">
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-text-primary">Preview</span>
          <div class="flex items-center gap-1.5">
            <div class={`w-2 h-2 rounded-full ${getStatusColor()}`} />
            <span class="text-xs text-text-tertiary">{getStatusText()}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="text-xs text-text-secondary hover:text-text-primary px-2 py-1 rounded hover:bg-bg-hover transition-colors"
            onClick={() => compileAndPreview()}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div class="flex-1 relative overflow-hidden">
        <Show when={props.enabled && isPreviewable(props.filePath, props.language)}>
          <iframe
            ref={iframeRef}
            class="w-full h-full border-0 bg-[#1a1a1a]"
            sandbox="allow-scripts allow-same-origin"
            title="Component Preview"
          />
        </Show>

        <Show when={!props.enabled}>
          <div class="absolute inset-0 flex items-center justify-center text-text-tertiary">
            <div class="text-center">
              <div class="text-2xl mb-2">👁</div>
              <div class="text-sm">Preview disabled</div>
            </div>
          </div>
        </Show>

        <Show when={props.enabled && !isPreviewable(props.filePath, props.language)}>
          <div class="absolute inset-0 flex items-center justify-center text-text-tertiary">
            <div class="text-center">
              <div class="text-2xl mb-2">📄</div>
              <div class="text-sm">Preview not available</div>
              <div class="text-xs mt-1">Only JSX/TSX files can be previewed</div>
            </div>
          </div>
        </Show>

        <Show when={state().status === "error"}>
          <div class="absolute bottom-4 left-4 right-4 bg-red-900/90 border border-red-500 rounded-lg p-3">
            <div class="text-red-200 text-xs font-mono whitespace-pre-wrap">{state().error}</div>
          </div>
        </Show>
      </div>
    </div>
  );
}
