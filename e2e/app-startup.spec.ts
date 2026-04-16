import { test, expect } from "@playwright/test";

test.describe("Piper App Startup", () => {
  test("app renders without crashing (startup smoke test)", async ({ page }) => {
    await page.goto("/");

    // The page should not be blank — at minimum a root element exists
    const root = page.locator("#root");
    await expect(root).toBeAttached({ timeout: 10000 });

    // The page should not show a React error overlay or crash
    const errorOverlay = page.locator("[data-react-error-overlay], [data-testid='error-boundary']");
    await expect(errorOverlay).not.toBeVisible();

    // Screenshot evidence
    await page.screenshot({ path: "e2e/screenshots/startup-smoke.png", fullPage: true });
  });

  test("app title is set", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/piper/i);
    await page.screenshot({ path: "e2e/screenshots/app-title.png", fullPage: true });
  });

  test("no console errors on startup", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    await page.waitForTimeout(3000);

    // Filter out known noise — focus on actual app errors
    const realErrors = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("manifest") &&
        !e.includes("DevTools")
    );

    expect(realErrors).toEqual([]);
    await page.screenshot({ path: "e2e/screenshots/no-console-errors.png", fullPage: true });
  });
});

test.describe("Store Stability E2E", () => {
  test("selection store does not cause infinite re-render", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      errors.push(err.message);
    });

    await page.goto("/");
    await page.waitForTimeout(5000);

    // If we got here without timeout/disconnect, there was no infinite loop
    const hasInfiniteLoopError = errors.some(
      (e) =>
        e.includes("Maximum update depth exceeded") ||
        e.includes("infinite") ||
        e.includes("useSyncExternalStore")
    );

    expect(hasInfiniteLoopError).toBe(false);
    await page.screenshot({
      path: "e2e/screenshots/store-stability.png",
      fullPage: true,
    });
  });
});
