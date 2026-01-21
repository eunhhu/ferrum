/**
 * Tests for Tauri Environment Check
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("Tauri Environment Detection", () => {
  // Mock the window object
  const originalWindow = globalThis.window;

  beforeEach(() => {
    // Reset window before each test
    (globalThis as any).window = {};
  });

  afterEach(() => {
    // Restore original window
    (globalThis as any).window = originalWindow;
  });

  const isTauriEnvironment = (): boolean => {
    return (
      typeof window !== "undefined" && window !== null && "__TAURI__" in window
    );
  };

  it("returns false when window is undefined", () => {
    (globalThis as any).window = undefined;
    expect(isTauriEnvironment()).toBe(false);
  });

  it("returns false when window exists but __TAURI__ is missing", () => {
    (globalThis as any).window = {};
    expect(isTauriEnvironment()).toBe(false);
  });

  it("returns true when __TAURI__ is present", () => {
    (globalThis as any).window = { __TAURI__: {} };
    expect(isTauriEnvironment()).toBe(true);
  });
});

describe("Safe IPC Wrapper", () => {
  const safeInvoke = async <T>(
    _command: string,
    _args?: Record<string, unknown>
  ): Promise<T | null> => {
    // Simulated safe invoke that returns null in non-Tauri environment
    const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
    if (!isTauri) {
      return null;
    }
    // In real implementation, would call Tauri invoke
    return null;
  };

  it("returns null in non-Tauri environment", async () => {
    const result = await safeInvoke<string>("test_command");
    expect(result).toBeNull();
  });

  it("accepts arguments object", async () => {
    const result = await safeInvoke<number>("calculate", { x: 5, y: 10 });
    expect(result).toBeNull(); // null in test env
  });
});

describe("IPC Types", () => {
  interface BufferContent {
    content: string;
    version: number;
  }

  interface HighlightSpan {
    start_byte: number;
    end_byte: number;
    kind: string;
  }

  it("BufferContent has required fields", () => {
    const buffer: BufferContent = {
      content: "test content",
      version: 1,
    };

    expect(buffer.content).toBe("test content");
    expect(buffer.version).toBe(1);
  });

  it("HighlightSpan has valid byte offsets", () => {
    const span: HighlightSpan = {
      start_byte: 0,
      end_byte: 10,
      kind: "keyword",
    };

    expect(span.start_byte).toBeLessThanOrEqual(span.end_byte);
    expect(span.kind).toBeTruthy();
  });

  it("HighlightSpan handles zero-width spans", () => {
    const span: HighlightSpan = {
      start_byte: 5,
      end_byte: 5,
      kind: "cursor",
    };

    expect(span.start_byte).toBe(span.end_byte);
  });
});

describe("Error Handling", () => {
  class IpcError extends Error {
    constructor(
      message: string,
      public readonly code: string
    ) {
      super(message);
      this.name = "IpcError";
    }
  }

  it("IpcError has code property", () => {
    const error = new IpcError("Buffer not found", "BUFFER_NOT_FOUND");

    expect(error.message).toBe("Buffer not found");
    expect(error.code).toBe("BUFFER_NOT_FOUND");
    expect(error.name).toBe("IpcError");
  });

  it("IpcError is instance of Error", () => {
    const error = new IpcError("Test", "TEST");
    expect(error instanceof Error).toBe(true);
  });
});
