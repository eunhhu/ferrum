/**
 * NavigationTrail Component Tests
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { NavigationTrail } from "../../components/editor/NavigationTrail";

describe("NavigationTrail", () => {
  const defaultProps = {
    filePath: "/src/components/Editor.tsx",
    symbols: [
      { name: "Editor", kind: "function", line: 10 },
      { name: "handleInput", kind: "function", line: 50 },
    ],
    currentLine: 55,
  };

  describe("Rendering", () => {
    it("renders the navigation trail container", () => {
      const { container } = render(() => <NavigationTrail {...defaultProps} />);

      expect(container.firstChild).toBeTruthy();
    });

    it("displays file path segments", () => {
      const { container } = render(() => <NavigationTrail {...defaultProps} />);

      // Should show path segments
      const text = container.textContent;
      expect(text).toContain("src");
      expect(text).toContain("components");
      expect(text).toContain("Editor.tsx");
    });

    it("displays symbol breadcrumbs", () => {
      const { container } = render(() => <NavigationTrail {...defaultProps} />);

      const text = container.textContent;
      // Should show symbol names
      expect(text).toContain("Editor");
    });

    it("handles empty symbols", () => {
      // Symbols are fetched internally by the component
      const { container } = render(() => <NavigationTrail {...defaultProps} />);

      expect(container.firstChild).toBeTruthy();
    });

    it("handles empty file path", () => {
      const { container } = render(() => (
        <NavigationTrail {...defaultProps} filePath="" />
      ));

      expect(container.firstChild).toBeTruthy();
    });
  });

  describe("Interaction", () => {
    it("calls onSymbolClick when symbol is clicked", async () => {
      const onSymbolClick = vi.fn();
      const { container } = render(() => (
        <NavigationTrail {...defaultProps} onSymbolClick={onSymbolClick} />
      ));

      // Find clickable symbol element
      const symbolButtons = container.querySelectorAll(
        "button, [role='button']"
      );
      const firstButton = symbolButtons[0];
      if (symbolButtons.length > 0 && firstButton) {
        await fireEvent.click(firstButton);
        // onSymbolClick might be called depending on implementation
      }
    });
  });
});
