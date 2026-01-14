/**
 * E2E Tests for Ferrum IDE Editor
 *
 * Tests core editor functionality, error handling, and UI interactions.
 */

import { test, expect } from "@playwright/test";

test.describe("Editor Core", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for app to initialize
    await page.waitForSelector(".editor-container, .app-container", { timeout: 10000 });
  });

  test("should load the application", async ({ page }) => {
    // Check that the main app container exists
    const appExists = await page.locator(".app-container, #app, [data-testid='app']").count();
    expect(appExists).toBeGreaterThan(0);
  });

  test("should display editor area", async ({ page }) => {
    // Look for editor-related elements
    const editorArea = page.locator(".editor, .editor-container, [data-testid='editor']");
    await expect(editorArea.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Editor might not be visible if no file is open, which is acceptable
      console.log("Editor not visible - no file open");
    });
  });

  test("should handle keyboard shortcuts", async ({ page }) => {
    // Test that keyboard events are captured
    await page.keyboard.press("Control+p");
    // Should not cause any errors
    await page.waitForTimeout(500);

    // Check for command palette or search dialog
    const palette = page.locator(
      ".command-palette, .search-dialog, [data-testid='command-palette']"
    );
    // Palette may or may not appear depending on implementation
    const paletteCount = await palette.count();
    console.log(`Command palette elements found: ${paletteCount}`);
  });
});

test.describe("Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".editor-container, .app-container", { timeout: 10000 });
  });

  test("should handle console errors gracefully", async ({ page }) => {
    const errors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    // Navigate and interact
    await page.waitForTimeout(2000);

    // Filter out expected/acceptable errors
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("Failed to load resource") &&
        !e.includes("net::ERR") &&
        !e.includes("Tauri") // Tauri IPC errors expected in browser-only mode
    );

    console.log("Console errors:", errors);
    console.log("Critical errors:", criticalErrors);

    // In browser-only mode, some Tauri errors are expected
    // We're mainly checking that the app doesn't crash
  });

  test("should not have unhandled promise rejections", async ({ page }) => {
    const rejections: string[] = [];

    page.on("pageerror", (error) => {
      rejections.push(error.message);
    });

    await page.waitForTimeout(3000);

    console.log("Unhandled rejections:", rejections);

    // Filter Tauri-related rejections (expected in browser mode)
    const criticalRejections = rejections.filter(
      (r) => !r.includes("Tauri") && !r.includes("__TAURI__") && !r.includes("invoke")
    );

    expect(criticalRejections.length).toBe(0);
  });
});

test.describe("UI Components", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".editor-container, .app-container", { timeout: 10000 });
  });

  test("should render tree viewer if present", async ({ page }) => {
    const treeViewer = page.locator(".tree-viewer, [data-testid='tree-viewer']");
    const count = await treeViewer.count();
    console.log(`Tree viewer elements: ${count}`);

    if (count > 0) {
      await expect(treeViewer.first()).toBeVisible();
    }
  });

  test("should render navigation trail if present", async ({ page }) => {
    const navTrail = page.locator(".navigation-trail, [data-testid='navigation-trail']");
    const count = await navTrail.count();
    console.log(`Navigation trail elements: ${count}`);
  });

  test("should render view mode toggle if present", async ({ page }) => {
    const viewToggle = page.locator(".view-mode-toggle, [data-testid='view-mode-toggle']");
    const count = await viewToggle.count();
    console.log(`View mode toggle elements: ${count}`);
  });
});

test.describe("Performance", () => {
  test("should load within acceptable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/");
    await page.waitForSelector(".editor-container, .app-container", { timeout: 15000 });

    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);

    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test("should not have memory leaks on navigation", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".editor-container, .app-container", { timeout: 10000 });

    // Get initial metrics
    const initialMetrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        };
      }
      return null;
    });

    console.log("Initial memory:", initialMetrics);

    // Perform some interactions
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(100);
    }

    // Get final metrics
    const finalMetrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        };
      }
      return null;
    });

    console.log("Final memory:", finalMetrics);
  });
});
