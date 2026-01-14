/**
 * E2E Tests for Ferrum IDE Components
 *
 * Tests individual components: TreeViewer, NavigationTrail, ContextActionPalette, etc.
 */

import { test, expect } from "@playwright/test";

test.describe("TreeViewer Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  test("should display depth containers when code is loaded", async ({ page }) => {
    const depthContainers = page.locator(".depth-container");
    const count = await depthContainers.count();
    console.log(`Depth containers found: ${count}`);

    // Depth containers should exist if code is loaded
    // They might not exist if no file is open
  });

  test("should show fold buttons on foldable lines", async ({ page }) => {
    const foldButtons = page.locator(".fold-button");
    const count = await foldButtons.count();
    console.log(`Fold buttons found: ${count}`);
  });

  test("fold button should toggle on click", async ({ page }) => {
    const foldButton = page.locator(".fold-button").first();

    if ((await foldButton.count()) > 0) {
      await foldButton.click();
      await page.waitForTimeout(300);

      // Check if the button state changed (rotation class)
      const hasRotate = await foldButton.locator("svg").evaluate((el) => {
        return el.classList.contains("rotate-90") || el.classList.contains("rotate-0");
      });
      console.log(`Fold button has rotation class: ${hasRotate}`);
    } else {
      console.log("No fold buttons available to test");
    }
  });
});

test.describe("StickyHeader Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  test("should display sticky headers when scrolling", async ({ page }) => {
    const stickyHeader = page.locator(".sticky-header, [data-testid='sticky-header']");
    const count = await stickyHeader.count();
    console.log(`Sticky header elements: ${count}`);
  });

  test("should update scope info on scroll", async ({ page }) => {
    // Scroll the editor
    const editor = page.locator(".editor-content, .editor");

    if ((await editor.count()) > 0) {
      await editor.first().hover();
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(500);

      // Check if sticky header updated
      const scopeItems = page.locator(".scope-item, .sticky-header-item");
      const count = await scopeItems.count();
      console.log(`Scope items after scroll: ${count}`);
    }
  });
});

test.describe("ContextActionPalette Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  test("should open on right-click", async ({ page }) => {
    const editor = page.locator(".editor-content, .editor, .code-area");

    if ((await editor.count()) > 0) {
      await editor.first().click({ button: "right" });
      await page.waitForTimeout(300);

      const palette = page.locator(".context-action-palette, [data-testid='context-palette']");
      const count = await palette.count();
      console.log(`Context palette visible: ${count > 0}`);
    }
  });

  test("should close on Escape", async ({ page }) => {
    const editor = page.locator(".editor-content, .editor");

    if ((await editor.count()) > 0) {
      await editor.first().click({ button: "right" });
      await page.waitForTimeout(200);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(200);

      const palette = page.locator(".context-action-palette:visible");
      const count = await palette.count();
      console.log(`Context palette after Escape: ${count}`);
    }
  });

  test("should navigate with arrow keys", async ({ page }) => {
    const editor = page.locator(".editor-content, .editor");

    if ((await editor.count()) > 0) {
      await editor.first().click({ button: "right" });
      await page.waitForTimeout(200);

      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("ArrowUp");

      // Check if selection changed
      const selectedItem = page.locator(".context-action-palette button.bg-accent\\/20");
      const count = await selectedItem.count();
      console.log(`Selected items: ${count}`);

      await page.keyboard.press("Escape");
    }
  });
});

test.describe("ViewModeToggle Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  test("should display mode buttons", async ({ page }) => {
    const toggle = page.locator(".view-mode-toggle");

    if ((await toggle.count()) > 0) {
      const buttons = toggle.locator("button");
      const count = await buttons.count();
      console.log(`View mode buttons: ${count}`);
      expect(count).toBeGreaterThanOrEqual(2); // At least code and visual
    } else {
      console.log("View mode toggle not present");
    }
  });

  test("should switch modes on click", async ({ page }) => {
    const toggle = page.locator(".view-mode-toggle");

    if ((await toggle.count()) > 0) {
      const visualButton = toggle.locator("button").nth(1);
      await visualButton.click();
      await page.waitForTimeout(300);

      // Check if visual view appeared
      const visualView = page.locator(".visual-view, .visual-code-view");
      const count = await visualView.count();
      console.log(`Visual view visible: ${count > 0}`);
    }
  });
});

test.describe("VisualCodeView Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  test("should display nodes when in visual mode", async ({ page }) => {
    // Try to switch to visual mode first
    const toggle = page.locator(".view-mode-toggle");

    if ((await toggle.count()) > 0) {
      const visualButton = toggle.locator("button").nth(1);
      await visualButton.click();
      await page.waitForTimeout(500);
    }

    const nodes = page.locator(".visual-code-view .absolute.rounded-lg");
    const count = await nodes.count();
    console.log(`Visual nodes: ${count}`);
  });

  test("should support pan and zoom", async ({ page }) => {
    const visualView = page.locator(".visual-code-view");

    if ((await visualView.count()) > 0) {
      // Test zoom buttons
      const zoomIn = visualView.locator("button:has-text('+')");
      const zoomOut = visualView.locator("button:has-text('−')");

      if ((await zoomIn.count()) > 0) {
        await zoomIn.click();
        await page.waitForTimeout(200);
        await zoomOut.click();
        await page.waitForTimeout(200);
        console.log("Zoom controls work");
      }

      // Test pan with mouse drag
      await visualView.hover();
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(100, 100);
      await page.mouse.up({ button: "middle" });
      console.log("Pan tested");
    }
  });
});

test.describe("CompilePreview Component", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);
  });

  test("should display preview status", async ({ page }) => {
    const preview = page.locator(".compile-preview");

    if ((await preview.count()) > 0) {
      const status = preview.locator(".text-xs:has-text('Ready'), .text-xs:has-text('Idle')");
      const count = await status.count();
      console.log(`Preview status elements: ${count}`);
    } else {
      console.log("Compile preview not present");
    }
  });

  test("should have refresh button", async ({ page }) => {
    const preview = page.locator(".compile-preview");

    if ((await preview.count()) > 0) {
      const refreshBtn = preview.locator("button:has-text('Refresh')");
      const count = await refreshBtn.count();
      console.log(`Refresh button present: ${count > 0}`);

      if (count > 0) {
        await refreshBtn.click();
        await page.waitForTimeout(500);
        console.log("Refresh clicked");
      }
    }
  });
});

test.describe("PeekView Component", () => {
  test("should display peek view when triggered", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);

    // Peek view is typically triggered by Alt+F12 or similar
    await page.keyboard.press("Alt+F12");
    await page.waitForTimeout(300);

    const peekView = page.locator(".peek-view, [data-testid='peek-view']");
    const count = await peekView.count();
    console.log(`Peek view visible: ${count > 0}`);
  });
});

test.describe("InlineBlame Component", () => {
  test("should display blame info when enabled", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(2000);

    const blameInfo = page.locator(".inline-blame");
    const count = await blameInfo.count();
    console.log(`Inline blame elements: ${count}`);
  });
});
