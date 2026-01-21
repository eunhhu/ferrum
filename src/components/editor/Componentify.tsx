/**
 * Componentify - Extract JSX to Component
 *
 * After Effects의 Precomp처럼 선택 영역을 컴포넌트로 추출합니다.
 * Features:
 * - 선택된 JSX 분석
 * - 사용된 변수 → Props로 변환
 * - 사용된 콜백 → Props로 변환
 * - TypeScript interface 자동 생성
 * - 새 파일 생성 또는 현재 파일에 추가
 */

import { createSignal, Show, For } from "solid-js";

interface ExtractedProp {
  name: string;
  type: string;
  isCallback: boolean;
  isOptional: boolean;
}

interface ComponentifyResult {
  componentName: string;
  props: ExtractedProp[];
  interfaceCode: string;
  componentCode: string;
  usageCode: string;
}

interface ComponentifyDialogProps {
  selectedCode: string;
  currentFileName: string;
  onExtract: (result: ComponentifyResult, createNewFile: boolean) => void;
  onCancel: () => void;
}

export function ComponentifyDialog(props: ComponentifyDialogProps) {
  const [componentName, setComponentName] = createSignal("NewComponent");
  const [createNewFile, setCreateNewFile] = createSignal(true);
  const [analysis, setAnalysis] = createSignal<ComponentifyResult | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  // Analyze the selected code on mount
  const analyzeSelection = () => {
    try {
      const result = analyzeJsx(props.selectedCode, componentName());
      setAnalysis(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to analyze selection");
    }
  };

  // Re-analyze when component name changes
  const handleNameChange = (name: string) => {
    setComponentName(name);
    if (props.selectedCode) {
      analyzeSelection();
    }
  };

  // Initial analysis
  if (props.selectedCode) {
    analyzeSelection();
  }

  const handleExtract = () => {
    const result = analysis();
    if (result) {
      props.onExtract(result, createNewFile());
    }
  };

  return (
    <div class="componentify-dialog fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-bg-primary border border-border rounded-lg shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 class="text-lg font-medium text-text-primary">
            Extract Component
          </h2>
          <button
            class="text-text-tertiary hover:text-text-primary transition-colors"
            onClick={props.onCancel}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Component Name */}
          <div>
            <label class="block text-sm text-text-secondary mb-1">
              Component Name
            </label>
            <input
              type="text"
              class="w-full px-3 py-2 bg-bg-secondary border border-border rounded text-text-primary focus:outline-none focus:border-accent"
              value={componentName()}
              onInput={(e) => handleNameChange(e.currentTarget.value)}
              placeholder="NewComponent"
            />
          </div>

          {/* File Option */}
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fileOption"
                checked={createNewFile()}
                onChange={() => setCreateNewFile(true)}
                class="accent-accent"
              />
              <span class="text-sm text-text-secondary">
                Create new file ({componentName()}.tsx)
              </span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="fileOption"
                checked={!createNewFile()}
                onChange={() => setCreateNewFile(false)}
                class="accent-accent"
              />
              <span class="text-sm text-text-secondary">
                Add to current file
              </span>
            </label>
          </div>

          {/* Error */}
          <Show when={error()}>
            <div class="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
              {error()}
            </div>
          </Show>

          {/* Analysis Result */}
          <Show when={analysis()}>
            {(result) => (
              <>
                {/* Detected Props */}
                <div>
                  <h3 class="text-sm font-medium text-text-primary mb-2">
                    Detected Props ({result().props.length})
                  </h3>
                  <Show
                    when={result().props.length > 0}
                    fallback={
                      <div class="text-sm text-text-tertiary">
                        No props detected
                      </div>
                    }
                  >
                    <div class="space-y-1">
                      <For each={result().props}>
                        {(prop) => (
                          <div class="flex items-center gap-2 px-2 py-1 bg-bg-secondary rounded">
                            <span class="font-mono text-sm text-accent">
                              {prop.name}
                            </span>
                            <span class="text-text-tertiary">:</span>
                            <span class="font-mono text-sm text-text-secondary">
                              {prop.type}
                            </span>
                            <Show when={prop.isCallback}>
                              <span class="px-1 py-0.5 text-[10px] bg-purple-900/50 text-purple-300 rounded">
                                callback
                              </span>
                            </Show>
                            <Show when={prop.isOptional}>
                              <span class="px-1 py-0.5 text-[10px] bg-blue-900/50 text-blue-300 rounded">
                                optional
                              </span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>

                {/* Generated Interface */}
                <div>
                  <h3 class="text-sm font-medium text-text-primary mb-2">
                    Generated Interface
                  </h3>
                  <pre class="p-3 bg-bg-tertiary rounded text-xs font-mono text-text-secondary overflow-x-auto">
                    {result().interfaceCode}
                  </pre>
                </div>

                {/* Generated Component */}
                <div>
                  <h3 class="text-sm font-medium text-text-primary mb-2">
                    Generated Component
                  </h3>
                  <pre class="p-3 bg-bg-tertiary rounded text-xs font-mono text-text-secondary overflow-x-auto max-h-48">
                    {result().componentCode}
                  </pre>
                </div>

                {/* Usage */}
                <div>
                  <h3 class="text-sm font-medium text-text-primary mb-2">
                    Usage
                  </h3>
                  <pre class="p-3 bg-bg-tertiary rounded text-xs font-mono text-text-secondary overflow-x-auto">
                    {result().usageCode}
                  </pre>
                </div>
              </>
            )}
          </Show>
        </div>

        {/* Footer */}
        <div class="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button
            class="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            onClick={props.onCancel}
          >
            Cancel
          </button>
          <button
            class="px-4 py-2 text-sm bg-accent hover:bg-accent/90 text-white rounded transition-colors disabled:opacity-50"
            onClick={handleExtract}
            disabled={!analysis() || !!error()}
          >
            Extract Component
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Analyze JSX code and extract component information
 */
function analyzeJsx(code: string, componentName: string): ComponentifyResult {
  const props: ExtractedProp[] = [];
  const usedVariables = new Set<string>();
  const usedCallbacks = new Set<string>();

  // Extract variable references (simple pattern matching)
  // In production, this would use tree-sitter for accurate parsing

  // Match {variable} patterns (JSX expressions)
  const expressionMatches = code.matchAll(/\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g);
  for (const match of expressionMatches) {
    if (match[1]) usedVariables.add(match[1]);
  }

  // Match {variable.property} patterns
  const memberMatches = code.matchAll(
    /\{([a-zA-Z_$][a-zA-Z0-9_$]*)\.([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g
  );
  for (const match of memberMatches) {
    if (match[1]) usedVariables.add(match[1]);
  }

  // Match onClick={handler} and similar event handlers
  const handlerMatches = code.matchAll(
    /on[A-Z][a-zA-Z]*=\{([a-zA-Z_$][a-zA-Z0-9_$]*)\}/g
  );
  for (const match of handlerMatches) {
    if (match[1]) usedCallbacks.add(match[1]);
  }

  // Match onClick={() => handler()} patterns
  const arrowHandlerMatches = code.matchAll(
    /on[A-Z][a-zA-Z]*=\{\(\)\s*=>\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\(/g
  );
  for (const match of arrowHandlerMatches) {
    if (match[1]) usedCallbacks.add(match[1]);
  }

  // Build props list
  for (const varName of usedVariables) {
    // Skip common React/DOM variables
    if (["className", "style", "children", "key", "ref"].includes(varName))
      continue;

    // Infer type (simple heuristics)
    let type = "unknown";
    if (
      varName.startsWith("is") ||
      varName.startsWith("has") ||
      varName.startsWith("show")
    ) {
      type = "boolean";
    } else if (
      varName.endsWith("List") ||
      varName.endsWith("Array") ||
      varName.endsWith("Items")
    ) {
      type = "any[]";
    } else if (
      varName.endsWith("Count") ||
      varName.endsWith("Index") ||
      varName.endsWith("Id")
    ) {
      type = "number";
    } else {
      type = "string";
    }

    props.push({
      name: varName,
      type,
      isCallback: false,
      isOptional: false,
    });
  }

  for (const callbackName of usedCallbacks) {
    props.push({
      name: callbackName,
      type: "() => void",
      isCallback: true,
      isOptional: true,
    });
  }

  // Generate interface code
  const interfaceCode = generateInterface(componentName, props);

  // Generate component code
  const componentCode = generateComponent(componentName, props, code);

  // Generate usage code
  const usageCode = generateUsage(componentName, props);

  return {
    componentName,
    props,
    interfaceCode,
    componentCode,
    usageCode,
  };
}

function generateInterface(name: string, props: ExtractedProp[]): string {
  if (props.length === 0) {
    return `// No props needed`;
  }

  const propsLines = props.map((p) => {
    const optional = p.isOptional ? "?" : "";
    return `  ${p.name}${optional}: ${p.type};`;
  });

  return `interface ${name}Props {
${propsLines.join("\n")}
}`;
}

function generateComponent(
  name: string,
  props: ExtractedProp[],
  jsxCode: string
): string {
  const propsDestructure =
    props.length > 0 ? `{ ${props.map((p) => p.name).join(", ")} }` : "props";

  const propsType = props.length > 0 ? `${name}Props` : "{}";

  // Indent the JSX code
  const indentedJsx = jsxCode
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

  return `export function ${name}(${propsDestructure}: ${propsType}) {
  return (
${indentedJsx}
  );
}`;
}

function generateUsage(name: string, props: ExtractedProp[]): string {
  if (props.length === 0) {
    return `<${name} />`;
  }

  const propsUsage = props
    .filter((p) => !p.isOptional)
    .map((p) => {
      if (p.isCallback) {
        return `${p.name}={${p.name}}`;
      }
      return `${p.name}={${p.name}}`;
    })
    .join(" ");

  return `<${name} ${propsUsage} />`;
}

/**
 * Helper hook/function for using Componentify
 */
export function useComponentify() {
  const [showDialog, setShowDialog] = createSignal(false);
  const [selectedCode, setSelectedCode] = createSignal("");
  const [currentFile, setCurrentFile] = createSignal("");

  const openComponentify = (code: string, fileName: string) => {
    setSelectedCode(code);
    setCurrentFile(fileName);
    setShowDialog(true);
  };

  const closeComponentify = () => {
    setShowDialog(false);
    setSelectedCode("");
  };

  return {
    showDialog,
    selectedCode,
    currentFile,
    openComponentify,
    closeComponentify,
  };
}
