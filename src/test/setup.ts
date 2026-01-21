/**
 * Vitest setup file
 *
 * Provides mocks for:
 * - HTMLCanvasElement (for TextMeasurer)
 * - Tauri API (for IPC commands)
 * - Window/Document APIs
 */

import { beforeAll, afterEach, vi } from "vitest";
import { cleanup } from "@solidjs/testing-library";

// Mock CanvasRenderingContext2D
class MockCanvasRenderingContext2D {
  font: string = "";
  fillStyle: string = "";
  strokeStyle: string = "";
  lineWidth: number = 1;
  textAlign: CanvasTextAlign = "start";
  textBaseline: CanvasTextBaseline = "alphabetic";

  measureText(text: string): TextMetrics {
    // Approximate monospace font: ~7.8px per character
    const charWidth = 7.8;
    return {
      width: text.length * charWidth,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * charWidth,
      fontBoundingBoxAscent: 12,
      fontBoundingBoxDescent: 4,
      emHeightAscent: 10,
      emHeightDescent: 3,
      hangingBaseline: 10,
      alphabeticBaseline: 0,
      ideographicBaseline: -3,
    };
  }

  fillText(_text: string, _x: number, _y: number): void {}
  strokeText(_text: string, _x: number, _y: number): void {}
  fillRect(_x: number, _y: number, _w: number, _h: number): void {}
  strokeRect(_x: number, _y: number, _w: number, _h: number): void {}
  clearRect(_x: number, _y: number, _w: number, _h: number): void {}
  beginPath(): void {}
  closePath(): void {}
  moveTo(_x: number, _y: number): void {}
  lineTo(_x: number, _y: number): void {}
  stroke(): void {}
  fill(): void {}
  save(): void {}
  restore(): void {}
  translate(_x: number, _y: number): void {}
  rotate(_angle: number): void {}
  scale(_x: number, _y: number): void {}
  setTransform(
    _a: number,
    _b: number,
    _c: number,
    _d: number,
    _e: number,
    _f: number
  ): void {}
  getTransform(): DOMMatrix {
    return new DOMMatrix();
  }
  resetTransform(): void {}
  clip(): void {}
  arc(_x: number, _y: number, _r: number, _start: number, _end: number): void {}
  arcTo(_x1: number, _y1: number, _x2: number, _y2: number, _r: number): void {}
  rect(_x: number, _y: number, _w: number, _h: number): void {}
  quadraticCurveTo(_cpx: number, _cpy: number, _x: number, _y: number): void {}
  bezierCurveTo(
    _cp1x: number,
    _cp1y: number,
    _cp2x: number,
    _cp2y: number,
    _x: number,
    _y: number
  ): void {}
  isPointInPath(_x: number, _y: number): boolean {
    return false;
  }
  isPointInStroke(_x: number, _y: number): boolean {
    return false;
  }
  createLinearGradient(
    _x0: number,
    _y0: number,
    _x1: number,
    _y1: number
  ): CanvasGradient {
    return { addColorStop: () => {} } as CanvasGradient;
  }
  createRadialGradient(
    _x0: number,
    _y0: number,
    _r0: number,
    _x1: number,
    _y1: number,
    _r1: number
  ): CanvasGradient {
    return { addColorStop: () => {} } as CanvasGradient;
  }
  createPattern(): CanvasPattern | null {
    return null;
  }
  drawImage(): void {}
  createImageData(_w: number, _h: number): ImageData {
    return new ImageData(_w, _h);
  }
  getImageData(_sx: number, _sy: number, _sw: number, _sh: number): ImageData {
    return new ImageData(_sw, _sh);
  }
  putImageData(): void {}
  getLineDash(): number[] {
    return [];
  }
  setLineDash(_segments: number[]): void {}
  lineDashOffset: number = 0;
  globalAlpha: number = 1;
  globalCompositeOperation: GlobalCompositeOperation = "source-over";
  shadowBlur: number = 0;
  shadowColor: string = "transparent";
  shadowOffsetX: number = 0;
  shadowOffsetY: number = 0;
  lineCap: CanvasLineCap = "butt";
  lineJoin: CanvasLineJoin = "miter";
  miterLimit: number = 10;
  canvas: HTMLCanvasElement = {} as HTMLCanvasElement;
  direction: CanvasDirection = "ltr";
  filter: string = "none";
  imageSmoothingEnabled: boolean = true;
  imageSmoothingQuality: ImageSmoothingQuality = "low";
  fontKerning: CanvasFontKerning = "auto";
  fontStretch: CanvasFontStretch = "normal";
  fontVariantCaps: CanvasFontVariantCaps = "normal";
  letterSpacing: string = "0px";
  wordSpacing: string = "0px";
  textRendering: CanvasTextRendering = "auto";
}

// Mock HTMLCanvasElement
class MockHTMLCanvasElement {
  width: number = 300;
  height: number = 150;
  private context2d = new MockCanvasRenderingContext2D();

  getContext(contextId: string): MockCanvasRenderingContext2D | null {
    if (contextId === "2d") {
      return this.context2d;
    }
    return null;
  }

  toDataURL(): string {
    return "data:image/png;base64,";
  }

  toBlob(): void {}
}

// Override document.createElement for canvas
const originalCreateElement = document.createElement.bind(document);
document.createElement = function (
  tagName: string,
  options?: ElementCreationOptions
) {
  if (tagName.toLowerCase() === "canvas") {
    return new MockHTMLCanvasElement() as unknown as HTMLCanvasElement;
  }
  return originalCreateElement(tagName, options);
};

// Mock Tauri API
const mockTauriInvoke = vi.fn(
  async (cmd: string, args?: Record<string, unknown>) => {
    console.log(`Mock Tauri invoke: ${cmd}`, args);

    switch (cmd) {
      case "get_highlights":
        return { highlights: [] };

      case "get_depth_regions":
        return [
          { start_line: 0, end_line: 10, depth: 0 },
          { start_line: 1, end_line: 5, depth: 1 },
          { start_line: 2, end_line: 3, depth: 2 },
        ];

      case "get_fold_state":
        return {
          folded_lines: [],
          fold_ranges: {},
        };

      case "toggle_fold":
        return true;

      case "buffer_undo":
      case "buffer_redo":
        return { content: args?.content || "" };

      case "expand_selection":
      case "shrink_selection":
        return {
          start_line: 0,
          start_character: 0,
          end_line: 0,
          end_character: 10,
        };

      case "lsp_goto_definition":
      case "lsp_references":
        return [];

      case "lsp_hover":
        return null;

      case "analyze_dependencies":
        return { imports: [], calls: [], references: [] };

      case "analyze_error_flow":
        return { try_blocks: [], catch_blocks: [], throw_statements: [] };

      case "get_document_symbols":
        return [];

      case "lsp_document_symbols":
        return [];

      case "get_git_blame":
        return [];

      case "lsp_completion":
        return { items: [] };

      default:
        console.warn(`Unhandled mock invoke: ${cmd}`);
        return null;
    }
  }
);

// Setup Tauri mock before all tests
beforeAll(() => {
  // Mock @tauri-apps/api/core
  vi.mock("@tauri-apps/api/core", () => ({
    invoke: mockTauriInvoke,
  }));

  // Also set window.__TAURI__ for legacy checks
  Object.defineProperty(window, "__TAURI__", {
    value: {
      invoke: mockTauriInvoke,
    },
    writable: true,
  });

  // Mock window.matchMedia
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();

  // Mock getBoundingClientRect
  Element.prototype.getBoundingClientRect = vi.fn(() => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Export mock for use in tests
export { mockTauriInvoke };
