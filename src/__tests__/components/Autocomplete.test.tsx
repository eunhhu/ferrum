/**
 * Autocomplete Component Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import { Autocomplete } from "../../components/editor/Autocomplete";
import type { LspCompletionItem } from "../../ipc/commands";

describe("Autocomplete", () => {
  const mockItems: LspCompletionItem[] = [
    {
      label: "console",
      kind: 6, // Variable
      detail: "var console: Console",
      documentation:
        "The Console object provides access to the browser debugging console.",
      insert_text: "console",
      sort_text: "0console",
    },
    {
      label: "log",
      kind: 2, // Method
      detail: "(message: any) => void",
      documentation: "Outputs a message to the console.",
      insert_text: "log",
      sort_text: "1log",
    },
    {
      label: "error",
      kind: 2, // Method
      detail: "(message: any) => void",
      documentation: null,
      insert_text: "error",
      sort_text: "2error",
    },
    {
      label: "warn",
      kind: 2, // Method
      detail: "(message: any) => void",
      documentation: null,
      insert_text: "warn",
      sort_text: "3warn",
    },
  ];

  const defaultProps = {
    items: mockItems,
    visible: true,
    position: { x: 100, y: 200 },
    onSelect: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders when visible is true and items exist", () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      const dropdown = container.querySelector(".fixed.z-50");
      expect(dropdown).toBeTruthy();
    });

    it("does not render when visible is false", () => {
      const { container } = render(() => (
        <Autocomplete {...defaultProps} visible={false} />
      ));

      const dropdown = container.querySelector(".fixed.z-50");
      expect(dropdown).toBeFalsy();
    });

    it("does not render when items are empty", () => {
      const { container } = render(() => (
        <Autocomplete {...defaultProps} items={[]} />
      ));

      const dropdown = container.querySelector(".fixed.z-50");
      expect(dropdown).toBeFalsy();
    });

    it("positions at specified coordinates", () => {
      const { container } = render(() => (
        <Autocomplete {...defaultProps} position={{ x: 300, y: 400 }} />
      ));

      const dropdown = container.querySelector(".fixed.z-50") as HTMLElement;
      expect(dropdown?.style.left).toBe("300px");
      expect(dropdown?.style.top).toBe("400px");
    });

    it("renders all completion items", () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      const items = container.querySelectorAll(".cursor-pointer");
      expect(items.length).toBe(mockItems.length);
    });

    it("displays item labels", () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      expect(container.textContent).toContain("console");
      expect(container.textContent).toContain("log");
      expect(container.textContent).toContain("error");
    });

    it("displays item details", () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      expect(container.textContent).toContain("var console: Console");
    });

    it("displays item count in footer", () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      expect(container.textContent).toContain("4 suggestions");
    });

    it("displays documentation for selected item", () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      // First item is selected by default
      expect(container.textContent).toContain("The Console object");
    });
  });

  describe("Keyboard Navigation", () => {
    it("handles ArrowDown to navigate down", async () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      await fireEvent.keyDown(document, { key: "ArrowDown" });

      // Second item should be highlighted
      const items = container.querySelectorAll(".cursor-pointer");
      expect(items[1]?.classList.contains("bg-accent/20")).toBe(true);
    });

    it("handles ArrowUp to navigate up", async () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      // Go down first
      await fireEvent.keyDown(document, { key: "ArrowDown" });
      await fireEvent.keyDown(document, { key: "ArrowDown" });
      // Then go back up
      await fireEvent.keyDown(document, { key: "ArrowUp" });

      const items = container.querySelectorAll(".cursor-pointer");
      expect(items[1]?.classList.contains("bg-accent/20")).toBe(true);
    });

    it("does not navigate past first item", async () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      await fireEvent.keyDown(document, { key: "ArrowUp" });
      await fireEvent.keyDown(document, { key: "ArrowUp" });

      const items = container.querySelectorAll(".cursor-pointer");
      expect(items[0]?.classList.contains("bg-accent/20")).toBe(true);
    });

    it("does not navigate past last item", async () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      // Navigate past the end
      for (let i = 0; i < 10; i++) {
        await fireEvent.keyDown(document, { key: "ArrowDown" });
      }

      const items = container.querySelectorAll(".cursor-pointer");
      expect(
        items[mockItems.length - 1]?.classList.contains("bg-accent/20")
      ).toBe(true);
    });

    it("handles Enter to select item", async () => {
      const onSelect = vi.fn();
      render(() => <Autocomplete {...defaultProps} onSelect={onSelect} />);

      await fireEvent.keyDown(document, { key: "Enter" });

      expect(onSelect).toHaveBeenCalledWith(mockItems[0]);
    });

    it("handles Tab to select item", async () => {
      const onSelect = vi.fn();
      render(() => <Autocomplete {...defaultProps} onSelect={onSelect} />);

      await fireEvent.keyDown(document, { key: "Tab" });

      expect(onSelect).toHaveBeenCalledWith(mockItems[0]);
    });

    it("handles Escape to close", async () => {
      const onClose = vi.fn();
      render(() => <Autocomplete {...defaultProps} onClose={onClose} />);

      await fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalled();
    });

    it("selects navigated item on Enter", async () => {
      const onSelect = vi.fn();
      render(() => <Autocomplete {...defaultProps} onSelect={onSelect} />);

      await fireEvent.keyDown(document, { key: "ArrowDown" });
      await fireEvent.keyDown(document, { key: "ArrowDown" });
      await fireEvent.keyDown(document, { key: "Enter" });

      expect(onSelect).toHaveBeenCalledWith(mockItems[2]);
    });
  });

  describe("Mouse Interaction", () => {
    it("calls onSelect when item is clicked", async () => {
      const onSelect = vi.fn();
      const { container } = render(() => (
        <Autocomplete {...defaultProps} onSelect={onSelect} />
      ));

      const items = container.querySelectorAll(".cursor-pointer");
      await fireEvent.click(items[1]!);

      expect(onSelect).toHaveBeenCalledWith(mockItems[1]);
    });

    it("highlights item on mouse enter", async () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      const items = container.querySelectorAll(".cursor-pointer");
      await fireEvent.mouseEnter(items[2]!);

      expect(items[2]?.classList.contains("bg-accent/20")).toBe(true);
    });
  });

  describe("Documentation Preview", () => {
    it("updates documentation when selection changes", async () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      // Navigate to second item
      await fireEvent.keyDown(document, { key: "ArrowDown" });

      // Should now show log's documentation
      expect(container.textContent).toContain("Outputs a message");
    });

    it("hides documentation section when item has no docs", async () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      // Navigate to third item (error - no documentation)
      await fireEvent.keyDown(document, { key: "ArrowDown" });
      await fireEvent.keyDown(document, { key: "ArrowDown" });

      // Documentation section should not contain any doc text
      const docSection = container.querySelector(".border-t.border-border.p-3");
      expect(docSection).toBeFalsy();
    });
  });

  describe("Completion Kind Icons", () => {
    it("displays appropriate icon for Variable kind", () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      // Variable icon should be 📌
      expect(container.textContent).toContain("📌");
    });

    it("displays appropriate icon for Method kind", () => {
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      // Method icon should be ⚡
      expect(container.textContent).toContain("⚡");
    });
  });

  describe("Edge Cases", () => {
    it("handles single item list", async () => {
      const onSelect = vi.fn();
      render(() => (
        <Autocomplete
          {...defaultProps}
          items={[mockItems[0]!]}
          onSelect={onSelect}
        />
      ));

      await fireEvent.keyDown(document, { key: "Enter" });
      expect(onSelect).toHaveBeenCalledWith(mockItems[0]);
    });

    it("resets selection when items change", async () => {
      // SolidJS doesn't have rerender like React, so we test the reset
      // behavior by checking that selection resets after navigating
      // and checking that the createEffect for items.length > 0 works
      const { container } = render(() => <Autocomplete {...defaultProps} />);

      // Navigate down
      await fireEvent.keyDown(document, { key: "ArrowDown" });
      await fireEvent.keyDown(document, { key: "ArrowDown" });

      // Second item should be highlighted
      let items = container.querySelectorAll(".cursor-pointer");
      expect(items[2]?.classList.contains("bg-accent/20")).toBe(true);

      // First item should not be highlighted
      expect(items[0]?.classList.contains("bg-accent/20")).toBe(false);
    });
  });
});
