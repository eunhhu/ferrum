/**
 * ContextActionPalette Component Tests
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { ContextActionPalette } from "../../components/editor/ContextActionPalette";

describe("ContextActionPalette", () => {
  const defaultProps = {
    visible: true,
    position: { x: 100, y: 100 },
    filePath: "/test/file.ts",
    bufferId: "test-buffer",
    line: 1,
    character: 0,
    selectionStartByte: 0,
    selectionEndByte: 0,
    onClose: vi.fn(),
  };

  describe("Rendering", () => {
    it("renders when visible is true", () => {
      const { container } = render(() => (
        <ContextActionPalette {...defaultProps} />
      ));

      // Should have the palette container
      const palette = container.querySelector(".fixed.z-50");
      expect(palette).toBeTruthy();
    });

    it("does not render when visible is false", () => {
      const { container } = render(() => (
        <ContextActionPalette {...defaultProps} visible={false} />
      ));

      const palette = container.querySelector(".fixed.z-50");
      expect(palette).toBeFalsy();
    });

    it("positions at specified coordinates", () => {
      const { container } = render(() => (
        <ContextActionPalette {...defaultProps} position={{ x: 200, y: 300 }} />
      ));

      const palette = container.querySelector(".fixed.z-50") as HTMLElement;
      if (palette) {
        expect(palette.style.left).toBe("200px");
        expect(palette.style.top).toBe("300px");
      }
    });

    it("renders search input", () => {
      const { container } = render(() => (
        <ContextActionPalette {...defaultProps} />
      ));

      const input = container.querySelector("input[type='text']");
      expect(input).toBeTruthy();
    });
  });

  describe("Actions", () => {
    it("shows selection actions when bufferId is provided", () => {
      const { container } = render(() => (
        <ContextActionPalette {...defaultProps} />
      ));

      // Should have some action buttons
      const actionButtons = container.querySelectorAll("button");
      expect(actionButtons.length).toBeGreaterThan(0);
    });

    it("shows AI actions when selectedText is provided", () => {
      const { container } = render(() => (
        <ContextActionPalette
          {...defaultProps}
          selectedText="function test() { return 42; }"
        />
      ));

      // Should have AI action buttons
      const actionButtons = container.querySelectorAll("button");
      expect(actionButtons.length).toBeGreaterThan(2);
    });

    it("shows fix error action when errorMessage is provided", () => {
      const { container } = render(() => (
        <ContextActionPalette
          {...defaultProps}
          selectedText="const x = "
          errorMessage="Unexpected end of input"
        />
      ));

      // Fix Error action should be present
      const buttons = container.querySelectorAll("button");
      const hasFixError = Array.from(buttons).some((btn) =>
        btn.textContent?.includes("Fix Error")
      );
      expect(hasFixError).toBe(true);
    });
  });

  describe("Keyboard Navigation", () => {
    it("handles Escape to close", async () => {
      const onClose = vi.fn();
      render(() => (
        <ContextActionPalette {...defaultProps} onClose={onClose} />
      ));

      await fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });

    it("handles ArrowDown for navigation", async () => {
      const { container } = render(() => (
        <ContextActionPalette {...defaultProps} />
      ));

      await fireEvent.keyDown(document, { key: "ArrowDown" });

      // Selection should move - check for highlighted item
      const highlightedItem = container.querySelector(".bg-accent\\/20");
      expect(highlightedItem).toBeTruthy();
    });

    it("handles ArrowUp for navigation", async () => {
      const { container } = render(() => (
        <ContextActionPalette {...defaultProps} />
      ));

      // Move down first, then up
      await fireEvent.keyDown(document, { key: "ArrowDown" });
      await fireEvent.keyDown(document, { key: "ArrowUp" });

      // Should still have highlighted item
      const highlightedItem = container.querySelector(".bg-accent\\/20");
      expect(highlightedItem).toBeTruthy();
    });

    it("handles Enter to execute action", async () => {
      const onClose = vi.fn();
      render(() => (
        <ContextActionPalette {...defaultProps} onClose={onClose} />
      ));

      await fireEvent.keyDown(document, { key: "Enter" });

      // Wait for async action to complete
      await vi.waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it("handles Tab for quick action", async () => {
      const onClose = vi.fn();
      render(() => (
        <ContextActionPalette {...defaultProps} onClose={onClose} />
      ));

      await fireEvent.keyDown(document, { key: "Tab" });

      // Wait for async action to complete
      await vi.waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe("Search/Filter", () => {
    it("filters actions based on input", async () => {
      const { container } = render(() => (
        <ContextActionPalette {...defaultProps} />
      ));

      const input = container.querySelector(
        "input[type='text']"
      ) as HTMLInputElement;
      if (input) {
        await fireEvent.input(input, { target: { value: "expand" } });

        // Should filter to show only matching actions
        const buttons = container.querySelectorAll("button");
        // At least the expand selection action should be visible
        expect(buttons.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Categories", () => {
    it("groups actions by category", () => {
      const { container } = render(() => (
        <ContextActionPalette {...defaultProps} selectedText="const x = 42;" />
      ));

      // Should have category headers
      const categoryHeaders = container.querySelectorAll(
        ".uppercase.tracking-wider"
      );
      expect(categoryHeaders.length).toBeGreaterThan(0);
    });
  });
});
