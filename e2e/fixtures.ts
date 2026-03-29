/**
 * Shared Playwright test fixtures for Piper E2E tests.
 *
 * - Automatically clears localStorage before each test so workspace/auth state
 *   never bleeds across specs.
 * - Provides a `waitForAppReady` helper that waits for the main app shell to
 *   hydrate and the first workspace to load.
 */
import { test as base, expect } from "@playwright/test";

type PiperFixtures = {
  /**
   * Resolves once the app has rendered its main shell and the topbar title
   * is visible (meaning mock data loaded successfully).
   */
  waitForAppReady: () => Promise<void>;
};

export const test = base.extend<PiperFixtures>({
  waitForAppReady: async ({ page }, use) => {
    const waitForAppReady = async () => {
      // Wait for the app shell to render – the topbar title contains workspace info
      await expect(page.locator("[data-testid='topbar-title']")).toBeVisible({ timeout: 15_000 });
    };
    await use(waitForAppReady);
  },
});

// Clear localStorage before each test to ensure clean state.
// We must navigate first to set the origin, then clear, then re-navigate
// so the app boots fresh.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  // Reload so the app picks up the clean localStorage
  await page.reload();
});

export { expect };
