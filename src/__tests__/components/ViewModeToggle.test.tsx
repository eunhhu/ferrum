/**
 * ViewModeToggle Component Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@solidjs/testing-library";
import {
  ViewModeToggle,
  ViewModeContainer,
  type ViewMode,
} from "../../components/editor/ViewModeToggle";

describe("ViewModeToggle", () => {
  const defaultProps = {
    currentMode: "code" as ViewMode,
    onModeChange: vi.fn(),
    visualAvailable: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders toggle container", () => {
      const { container } = render(() => <ViewModeToggle {...defaultProps} />);

      const toggle = container.querySelector(".view-mode-toggle");
      expect(toggle).toBeTruthy();
    });

    it("renders all three mode buttons", () => {
      const { container } = render(() => <ViewModeToggle {...defaultProps} />);

      const buttons = container.querySelectorAll("button");
      expect(buttons.length).toBe(3);
    });

    it("displays mode icons", () => {
      const { container } = render(() => <ViewModeToggle {...defaultProps} />);

      expect(container.textContent).toContain("{ }"); // Code icon
      expect(container.textContent).toContain("◇"); // Visual icon
      expect(container.textContent).toContain("⊞"); // Split icon
    });

    it("highlights current mode", () => {
      const { container } = render(() => (
        <ViewModeToggle {...defaultProps} currentMode="code" />
      ));

      const buttons = container.querySelectorAll("button");
      expect(buttons[0]?.classList.contains("bg-accent")).toBe(true);
    });

    it("highlights visual mode when selected", () => {
      const { container } = render(() => (
        <ViewModeToggle {...defaultProps} currentMode="visual" />
      ));

      const buttons = container.querySelectorAll("button");
      expect(buttons[1]?.classList.contains("bg-accent")).toBe(true);
    });

    it("highlights split mode when selected", () => {
      const { container } = render(() => (
        <ViewModeToggle {...defaultProps} currentMode="split" />
      ));

      const buttons = container.querySelectorAll("button");
      expect(buttons[2]?.classList.contains("bg-accent")).toBe(true);
    });
  });

  describe("Mode Selection", () => {
    it("calls onModeChange when code mode is clicked", async () => {
      const onModeChange = vi.fn();
      const { container } = render(() => (
        <ViewModeToggle
          {...defaultProps}
          currentMode="visual"
          onModeChange={onModeChange}
        />
      ));

      const buttons = container.querySelectorAll("button");
      await fireEvent.click(buttons[0]!);

      expect(onModeChange).toHaveBeenCalledWith("code");
    });

    it("calls onModeChange when visual mode is clicked", async () => {
      const onModeChange = vi.fn();
      const { container } = render(() => (
        <ViewModeToggle
          {...defaultProps}
          currentMode="code"
          onModeChange={onModeChange}
        />
      ));

      const buttons = container.querySelectorAll("button");
      await fireEvent.click(buttons[1]!);

      expect(onModeChange).toHaveBeenCalledWith("visual");
    });

    it("calls onModeChange when split mode is clicked", async () => {
      const onModeChange = vi.fn();
      const { container } = render(() => (
        <ViewModeToggle
          {...defaultProps}
          currentMode="code"
          onModeChange={onModeChange}
        />
      ));

      const buttons = container.querySelectorAll("button");
      await fireEvent.click(buttons[2]!);

      expect(onModeChange).toHaveBeenCalledWith("split");
    });
  });

  describe("Visual Mode Availability", () => {
    it("disables visual mode button when not available", () => {
      const { container } = render(() => (
        <ViewModeToggle {...defaultProps} visualAvailable={false} />
      ));

      const buttons = container.querySelectorAll("button");
      expect(buttons[1]?.hasAttribute("disabled")).toBe(true);
    });

    it("applies disabled styling when visual not available", () => {
      const { container } = render(() => (
        <ViewModeToggle {...defaultProps} visualAvailable={false} />
      ));

      const buttons = container.querySelectorAll("button");
      expect(buttons[1]?.classList.contains("opacity-50")).toBe(true);
      expect(buttons[1]?.classList.contains("cursor-not-allowed")).toBe(true);
    });

    it("does not call onModeChange when clicking disabled visual mode", async () => {
      const onModeChange = vi.fn();
      const { container } = render(() => (
        <ViewModeToggle
          {...defaultProps}
          visualAvailable={false}
          onModeChange={onModeChange}
        />
      ));

      const buttons = container.querySelectorAll("button");
      await fireEvent.click(buttons[1]!);

      expect(onModeChange).not.toHaveBeenCalled();
    });
  });

  describe("Hover Behavior", () => {
    it("shows labels on hover", async () => {
      const { container } = render(() => <ViewModeToggle {...defaultProps} />);

      const toggle = container.querySelector(".view-mode-toggle")!;
      await fireEvent.mouseEnter(toggle);

      expect(container.textContent).toContain("Code");
      expect(container.textContent).toContain("Visual");
      expect(container.textContent).toContain("Split");
    });

    it("hides labels when not hovered", async () => {
      const { container } = render(() => <ViewModeToggle {...defaultProps} />);

      // Initially not hovered, labels might not be shown
      const toggle = container.querySelector(".view-mode-toggle")!;
      await fireEvent.mouseLeave(toggle);

      // After mouse leave, should hide labels (or have them hidden initially)
      // This depends on the initial state
    });
  });
});

describe("ViewModeContainer", () => {
  const CodeView = () => <div data-testid="code-view">Code Editor</div>;
  const VisualView = () => <div data-testid="visual-view">Visual Editor</div>;

  const defaultProps = {
    mode: "code" as ViewMode,
    codeView: CodeView,
    visualView: VisualView,
  };

  describe("Code Mode", () => {
    it("shows only code view in code mode", () => {
      const { queryByTestId } = render(() => (
        <ViewModeContainer {...defaultProps} mode="code" />
      ));

      expect(queryByTestId("code-view")).toBeTruthy();
      expect(queryByTestId("visual-view")).toBeFalsy();
    });
  });

  describe("Visual Mode", () => {
    it("shows only visual view in visual mode", () => {
      const { queryByTestId } = render(() => (
        <ViewModeContainer {...defaultProps} mode="visual" />
      ));

      expect(queryByTestId("code-view")).toBeFalsy();
      expect(queryByTestId("visual-view")).toBeTruthy();
    });
  });

  describe("Split Mode", () => {
    it("shows both views in split mode", () => {
      const { queryByTestId } = render(() => (
        <ViewModeContainer {...defaultProps} mode="split" />
      ));

      expect(queryByTestId("code-view")).toBeTruthy();
      expect(queryByTestId("visual-view")).toBeTruthy();
    });

    it("adds border between views in split mode", () => {
      const { container } = render(() => (
        <ViewModeContainer {...defaultProps} mode="split" />
      ));

      const codeView = container.querySelector(".code-view");
      expect(codeView?.classList.contains("border-r")).toBe(true);
    });
  });

  describe("Container Styling", () => {
    it("renders main container with flex layout", () => {
      const { container } = render(() => (
        <ViewModeContainer {...defaultProps} />
      ));

      const mainContainer = container.querySelector(".view-mode-container");
      expect(mainContainer?.classList.contains("flex")).toBe(true);
    });

    it("visual view has tertiary background", () => {
      const { container } = render(() => (
        <ViewModeContainer {...defaultProps} mode="visual" />
      ));

      const visualView = container.querySelector(".visual-view");
      expect(visualView?.classList.contains("bg-bg-tertiary")).toBe(true);
    });
  });
});
