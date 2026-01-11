import { describe, it, expect } from "vitest";
import { render } from "@solidjs/testing-library";
import { Editor } from "../../components/editor/Editor";

describe("Editor", () => {
  it("renders with content", () => {
    const testContent = "function test() {\n  return 42;\n}";
    
    const { container } = render(() => (
      <Editor
        bufferId="test-1"
        content={testContent}
        language="typescript"
      />
    ));
    
    expect(container.querySelector(".editor-container")).toBeTruthy();
  });

  it("displays line numbers", () => {
    const testContent = "line 1\nline 2\nline 3";
    
    const { container } = render(() => (
      <Editor
        bufferId="test-1"
        content={testContent}
      />
    ));
    
    // Should have gutter with line numbers
    const gutter = container.querySelector(".bg-bg-secondary");
    expect(gutter).toBeTruthy();
  });

  it("handles content changes", () => {
    let changedContent = "";
    const testContent = "initial content";
    
    const { container } = render(() => (
      <Editor
        bufferId="test-1"
        content={testContent}
        onContentChange={(content) => {
          changedContent = content;
        }}
      />
    ));
    
    const textarea = container.querySelector("textarea");
    expect(textarea).toBeTruthy();
    
    if (textarea) {
      textarea.value = "new content";
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      
      // Content should be updated
      expect(changedContent).toBe("new content");
    }
  });

  it("supports virtual scrolling", () => {
    const lines = Array.from({ length: 1000 }, (_, i) => `line ${i + 1}`);
    const testContent = lines.join("\n");
    
    const { container } = render(() => (
      <Editor
        bufferId="test-1"
        content={testContent}
      />
    ));
    
    // Should render only visible lines, not all 1000
    const renderedLines = container.querySelectorAll(".h-5.leading-5");
    expect(renderedLines.length).toBeLessThan(1000);
  });
});
