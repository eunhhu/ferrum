/**
 * Simplified App for Testing
 * 
 * Clean UI to test TreeViewer and Editor components
 */

import { createSignal, onMount } from "solid-js";
import { Editor } from "./components/editor/Editor";
import { TreeViewer } from "./components/tree-viewer/TreeViewer";
import { StickyHeader } from "./components/tree-viewer/StickyHeader";
import type { ScopeInfo } from "./ipc/types";

const SAMPLE_CODE = `function fibonacci(n: number): number {
  if (n <= 1) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
  
  multiply(a: number, b: number): number {
    return a * b;
  }
}

for (let i = 0; i < 10; i++) {
  console.log(fibonacci(i));
}
`;

function App() {
  const [bufferId] = createSignal("test-buffer-1");
  const [content, setContent] = createSignal(SAMPLE_CODE);
  const [currentLine, setCurrentLine] = createSignal(0);
  const [scopes, setScopes] = createSignal<ScopeInfo[]>([]);

  let editorContainerRef: HTMLDivElement | undefined;

  onMount(() => {
    // Mock scope data for testing
    setScopes([
      { start_line: 0, end_line: 4, depth: 1, scope_name: "fibonacci", scope_type: "function_declaration" },
      { start_line: 1, end_line: 3, depth: 2, scope_name: "if", scope_type: "if_statement" },
      { start_line: 6, end_line: 13, depth: 1, scope_name: "class Calculator", scope_type: "class_declaration" },
      { start_line: 7, end_line: 9, depth: 2, scope_name: "add", scope_type: "method_declaration" },
      { start_line: 11, end_line: 13, depth: 2, scope_name: "multiply", scope_type: "method_declaration" },
      { start_line: 15, end_line: 17, depth: 1, scope_name: "for", scope_type: "for_statement" },
    ]);

    // Track scroll to update current line
    if (editorContainerRef) {
      editorContainerRef.addEventListener("scroll", (e) => {
        const target = e.target as HTMLDivElement;
        const lineHeight = 20;
        const line = Math.floor(target.scrollTop / lineHeight);
        setCurrentLine(line);
      });
    }
  });

  return (
    <div class="h-screen w-screen bg-gray-900 text-white flex flex-col">
      {/* Sticky Headers */}
      <StickyHeader scopes={scopes()} currentLine={currentLine()} />

      {/* Header */}
      <div class="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4">
        <h1 class="text-lg font-semibold">Ferrum IDE - Tree Viewer Test</h1>
      </div>

      {/* Main Content */}
      <div class="flex-1 flex overflow-hidden">
        {/* Editor with TreeViewer overlay */}
        <div class="flex-1 relative" ref={editorContainerRef}>
          <Editor
            bufferId={bufferId()}
            content={content()}
            language="typescript"
            onContentChange={setContent}
          />
          <TreeViewer
            bufferId={bufferId()}
            lineCount={content().split("\n").length}
          />
        </div>

        {/* Info Panel */}
        <div class="w-80 bg-gray-800 border-l border-gray-700 p-4 overflow-auto">
          <h2 class="text-sm font-semibold mb-4">Component Info</h2>
          <div class="space-y-2 text-xs">
            <div>
              <span class="text-gray-400">Buffer ID:</span>
              <span class="ml-2">{bufferId()}</span>
            </div>
            <div>
              <span class="text-gray-400">Lines:</span>
              <span class="ml-2">{content().split("\n").length}</span>
            </div>
            <div>
              <span class="text-gray-400">Current Line:</span>
              <span class="ml-2">{currentLine() + 1}</span>
            </div>
            <div>
              <span class="text-gray-400">Language:</span>
              <span class="ml-2">TypeScript</span>
            </div>
          </div>

          <div class="mt-6">
            <h3 class="text-sm font-semibold mb-2">Features</h3>
            <ul class="text-xs space-y-1 text-gray-400">
              <li>✓ Depth visualization</li>
              <li>✓ Code folding</li>
              <li>✓ Sticky headers</li>
              <li>✓ Syntax highlighting</li>
              <li>✓ Virtual scrolling</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
