/**
 * HoverTooltip Component Tests
 */

import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { HoverTooltip } from "../../components/editor/HoverTooltip";

describe("HoverTooltip", () => {
  const defaultProps = {
    content: "function test(): void",
    visible: true,
    position: { x: 100, y: 200 },
  };

  describe("Rendering", () => {
    it("renders when visible is true and content exists", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} />);

      const tooltip = container.querySelector(".fixed.z-40");
      expect(tooltip).toBeTruthy();
    });

    it("does not render when visible is false", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} visible={false} />);

      const tooltip = container.querySelector(".fixed.z-40");
      expect(tooltip).toBeFalsy();
    });

    it("does not render when content is null", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} content={null} />);

      const tooltip = container.querySelector(".fixed.z-40");
      expect(tooltip).toBeFalsy();
    });

    it("does not render when content is empty string", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} content="" />);

      // Empty string is falsy, so it shouldn't render
      const tooltip = container.querySelector(".fixed.z-40");
      expect(tooltip).toBeFalsy();
    });

    it("positions at specified coordinates", () => {
      const { container } = render(() => (
        <HoverTooltip {...defaultProps} position={{ x: 300, y: 400 }} />
      ));

      const tooltip = container.querySelector(".fixed.z-40") as HTMLElement;
      expect(tooltip?.style.left).toBe("300px");
      expect(tooltip?.style.top).toBe("400px");
    });

    it("displays content text", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} />);

      expect(container.textContent).toContain("function test(): void");
    });

    it("has pointer-events-none to not interfere with mouse", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} />);

      const tooltip = container.querySelector(".pointer-events-none");
      expect(tooltip).toBeTruthy();
    });
  });

  describe("Content Formatting", () => {
    it("renders multiline content correctly", () => {
      const multilineContent = `function test(): void
Returns: undefined
Throws: Error on invalid input`;

      const { container } = render(() => (
        <HoverTooltip {...defaultProps} content={multilineContent} />
      ));

      expect(container.textContent).toContain("Returns: undefined");
      expect(container.textContent).toContain("Throws: Error");
    });

    it("renders code-like content with monospace font", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} />);

      const pre = container.querySelector("pre.font-mono");
      expect(pre).toBeTruthy();
    });

    it("preserves whitespace in content", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} />);

      const pre = container.querySelector(".whitespace-pre-wrap");
      expect(pre).toBeTruthy();
    });
  });

  describe("Edge Cases", () => {
    it("handles very long content", () => {
      const longContent = "a".repeat(1000);
      const { container } = render(() => <HoverTooltip {...defaultProps} content={longContent} />);

      const tooltip = container.querySelector(".fixed.z-40");
      expect(tooltip).toBeTruthy();
      expect(container.textContent).toContain("aaa");
    });

    it("handles special characters in content", () => {
      const specialContent = '<div>Test & "quoted"</div>';
      const { container } = render(() => (
        <HoverTooltip {...defaultProps} content={specialContent} />
      ));

      expect(container.textContent).toContain("<div>");
      expect(container.textContent).toContain("&");
    });

    it("handles unicode content", () => {
      const unicodeContent = "함수 테스트(): void 🚀";
      const { container } = render(() => (
        <HoverTooltip {...defaultProps} content={unicodeContent} />
      ));

      expect(container.textContent).toContain("함수 테스트");
      expect(container.textContent).toContain("🚀");
    });
  });

  describe("Styling", () => {
    it("has max-width constraint", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} />);

      const tooltip = container.querySelector(".fixed.z-40") as HTMLElement;
      expect(tooltip?.style.maxWidth).toBe("600px");
    });

    it("has max-height constraint", () => {
      const { container } = render(() => <HoverTooltip {...defaultProps} />);

      const tooltip = container.querySelector(".fixed.z-40") as HTMLElement;
      expect(tooltip?.style.maxHeight).toBe("300px");
    });
  });
});
