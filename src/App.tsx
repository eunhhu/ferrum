/**
 * Ferrum IDE - Main Application
 * 
 * A high-performance code editor with advanced features.
 */

import { createSignal, onMount } from "solid-js";
import { Editor } from "./components/editor/Editor";
import { TreeViewer } from "./components/tree-viewer/TreeViewer";
import { StickyHeader } from "./components/tree-viewer/StickyHeader";
import type { ScopeInfo } from "./ipc/types";

// Longer sample code for testing scroll behavior
const SAMPLE_CODE = `// Ferrum IDE - Sample Code
// This file demonstrates various TypeScript features

function fibonacci(n: number): number {
  if (n <= 1) {
    return n;
  }
  return fibonacci(n - 1) + fibonacci(n - 2);
}

class Calculator {
  private history: number[] = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(result);
    return result;
  }
  
  subtract(a: number, b: number): number {
    const result = a - b;
    this.history.push(result);
    return result;
  }

  multiply(a: number, b: number): number {
    const result = a * b;
    this.history.push(result);
    return result;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error("Division by zero");
    }
    const result = a / b;
    this.history.push(result);
    return result;
  }

  getHistory(): number[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}

interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUsers(): Promise<User[]> {
  const response = await fetch("/api/users");
  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }
  return response.json();
}

// Main execution
const calc = new Calculator();
console.log("Addition:", calc.add(5, 3));
console.log("Subtraction:", calc.subtract(10, 4));
console.log("Multiplication:", calc.multiply(6, 7));

for (let i = 0; i < 10; i++) {
  console.log(\`Fibonacci(\${i}) = \${fibonacci(i)}\`);
}

// Export for module usage
export { Calculator, fibonacci, fetchUsers };
export type { User };
`;

function App() {
  const [bufferId] = createSignal("test-buffer-1");
  const [content, setContent] = createSignal(SAMPLE_CODE);
  const [currentLine, setCurrentLine] = createSignal(0);
  const [scopes, setScopes] = createSignal<ScopeInfo[]>([]);
  
  onMount(() => {
    // Mock scope data - in production, this comes from tree-sitter analysis
    setScopes([
      { start_line: 3, end_line: 8, depth: 1, scope_name: "fibonacci", scope_type: "function_declaration" },
      { start_line: 4, end_line: 6, depth: 2, scope_name: "if", scope_type: "if_statement" },
      { start_line: 10, end_line: 54, depth: 1, scope_name: "Calculator", scope_type: "class_declaration" },
      { start_line: 13, end_line: 17, depth: 2, scope_name: "add", scope_type: "method_declaration" },
      { start_line: 19, end_line: 23, depth: 2, scope_name: "subtract", scope_type: "method_declaration" },
      { start_line: 25, end_line: 29, depth: 2, scope_name: "multiply", scope_type: "method_declaration" },
      { start_line: 31, end_line: 38, depth: 2, scope_name: "divide", scope_type: "method_declaration" },
      { start_line: 32, end_line: 34, depth: 3, scope_name: "if", scope_type: "if_statement" },
      { start_line: 40, end_line: 42, depth: 2, scope_name: "getHistory", scope_type: "method_declaration" },
      { start_line: 44, end_line: 46, depth: 2, scope_name: "clearHistory", scope_type: "method_declaration" },
      { start_line: 56, end_line: 62, depth: 1, scope_name: "fetchUsers", scope_type: "function_declaration" },
      { start_line: 57, end_line: 60, depth: 2, scope_name: "if", scope_type: "if_statement" },
      { start_line: 70, end_line: 72, depth: 1, scope_name: "for loop", scope_type: "for_statement" },
    ]);
  });

  const handleScrollChange = (_scrollTop: number, visibleStartLine: number) => {
    setCurrentLine(visibleStartLine);
  };

  const handleScopeClick = (scope: ScopeInfo) => {
    // Call editor's scrollToLine via window global
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scrollFn = (window as any).__ferrum_editor_scrollToLine;
    if (typeof scrollFn === 'function') {
      scrollFn(scope.start_line);
    }
  };

  return (
    <div class="h-screen w-screen bg-bg-primary text-text-primary flex overflow-hidden">
      {/* Editor Area - relative container for z-stacking */}
      <div class="flex-1 relative overflow-hidden">
        {/* Sticky Headers - absolute positioned, z-stacked above editor */}
        <StickyHeader 
          scopes={scopes()} 
          currentLine={currentLine()} 
          onScopeClick={handleScopeClick}
        />
        
        {/* Editor - fills the container */}
        <Editor
          bufferId={bufferId()}
          content={content()}
          language="typescript"
          onContentChange={setContent}
          onScrollChange={handleScrollChange}
        />
        
        {/* TreeViewer overlay */}
        <TreeViewer
          bufferId={bufferId()}
          lineCount={content().split("\n").length}
        />
      </div>

      {/* Debug Panel */}
      <div class="w-56 bg-bg-secondary border-l border-border p-3 overflow-auto text-xs">
        <h2 class="font-semibold mb-3 text-text-primary">Debug</h2>
        <div class="space-y-1 text-text-secondary">
          <div class="flex justify-between">
            <span>Lines:</span>
            <span class="text-text-primary">{content().split("\n").length}</span>
          </div>
          <div class="flex justify-between">
            <span>Visible:</span>
            <span class="text-text-primary">{currentLine() + 1}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
