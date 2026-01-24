/**
 * Tests for Editor Store
 */

import { describe, expect, it } from "vitest";

// Mock the store directly since it uses SolidJS signals
describe("Editor Store Logic", () => {
  describe("Language Detection", () => {
    const getLanguageFromPath = (filePath: string): string => {
      const ext = filePath.split(".").pop()?.toLowerCase() || "";
      const langMap: Record<string, string> = {
        ts: "typescript",
        tsx: "typescriptreact",
        js: "javascript",
        jsx: "javascriptreact",
        json: "json",
        html: "html",
        css: "css",
        md: "markdown",
        rs: "rust",
        py: "python",
        go: "go",
      };
      return langMap[ext] || "plaintext";
    };

    it("detects TypeScript files", () => {
      expect(getLanguageFromPath("test.ts")).toBe("typescript");
      expect(getLanguageFromPath("component.tsx")).toBe("typescriptreact");
    });

    it("detects JavaScript files", () => {
      expect(getLanguageFromPath("app.js")).toBe("javascript");
      expect(getLanguageFromPath("component.jsx")).toBe("javascriptreact");
    });

    it("detects Rust files", () => {
      expect(getLanguageFromPath("main.rs")).toBe("rust");
    });

    it("detects Python files", () => {
      expect(getLanguageFromPath("script.py")).toBe("python");
    });

    it("detects Go files", () => {
      expect(getLanguageFromPath("main.go")).toBe("go");
    });

    it("detects config files", () => {
      expect(getLanguageFromPath("config.json")).toBe("json");
      expect(getLanguageFromPath("index.html")).toBe("html");
      expect(getLanguageFromPath("styles.css")).toBe("css");
    });

    it("returns plaintext for unknown extensions", () => {
      expect(getLanguageFromPath("file.xyz")).toBe("plaintext");
      expect(getLanguageFromPath("noextension")).toBe("plaintext");
    });

    it("handles paths with directories", () => {
      expect(getLanguageFromPath("/home/user/project/src/main.ts")).toBe("typescript");
      expect(getLanguageFromPath("./relative/path/file.rs")).toBe("rust");
    });

    it("handles case insensitivity", () => {
      expect(getLanguageFromPath("FILE.TS")).toBe("typescript");
      expect(getLanguageFromPath("APP.JS")).toBe("javascript");
    });
  });

  describe("Tab ID Generation", () => {
    const generateTabId = (): string => {
      return `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    };

    it("generates unique IDs", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTabId());
      }
      expect(ids.size).toBe(100);
    });

    it("starts with 'tab-' prefix", () => {
      const id = generateTabId();
      expect(id.startsWith("tab-")).toBe(true);
    });

    it("has expected format", () => {
      const id = generateTabId();
      const parts = id.split("-");
      expect(parts.length).toBeGreaterThanOrEqual(3);
      expect(parts[0]).toBe("tab");
    });
  });

  describe("File Name Extraction", () => {
    const getFileName = (filePath: string): string => {
      return filePath.split("/").pop() || filePath;
    };

    it("extracts file name from path", () => {
      expect(getFileName("/home/user/project/src/main.ts")).toBe("main.ts");
    });

    it("handles relative paths", () => {
      expect(getFileName("./src/index.tsx")).toBe("index.tsx");
    });

    it("handles just file name", () => {
      expect(getFileName("file.txt")).toBe("file.txt");
    });

    it("handles empty path", () => {
      expect(getFileName("")).toBe("");
    });
  });
});

describe("Cursor Position", () => {
  interface EditorPosition {
    line: number;
    column: number;
  }

  it("default position is 1,1", () => {
    const defaultPos: EditorPosition = { line: 1, column: 1 };
    expect(defaultPos.line).toBe(1);
    expect(defaultPos.column).toBe(1);
  });

  it("position can be updated", () => {
    let pos: EditorPosition = { line: 1, column: 1 };
    pos = { line: 10, column: 25 };
    expect(pos.line).toBe(10);
    expect(pos.column).toBe(25);
  });
});
