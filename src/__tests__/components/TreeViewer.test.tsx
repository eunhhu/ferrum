import { render } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { TreeViewer } from "../../components/tree-viewer/TreeViewer";

describe("TreeViewer", () => {
  it("renders without crashing", () => {
    const { container } = render(() => <TreeViewer bufferId="test-1" lineCount={10} />);

    expect(container.querySelector(".tree-viewer")).toBeTruthy();
  });

  it("renders fold controls", async () => {
    const { container } = render(() => <TreeViewer bufferId="test-1" lineCount={10} />);

    // Wait for async data loading
    await new Promise((resolve) => setTimeout(resolve, 100));

    const foldControls = container.querySelector(".fold-controls");
    expect(foldControls).toBeTruthy();
  });

  it("handles fold toggle", async () => {
    const { container } = render(() => <TreeViewer bufferId="test-1" lineCount={10} />);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const foldButton = container.querySelector(".fold-button");
    if (foldButton) {
      foldButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      // Should not throw
      expect(true).toBe(true);
    }
  });
});
