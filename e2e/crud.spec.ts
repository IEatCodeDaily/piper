import { test, expect } from "./fixtures";

test.describe("CRUD flow", () => {
  test.beforeEach(async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();
  });

  test("can read task list and select a task for details", async ({ page }) => {
    await page.locator("[data-testid='nav-item-list']").click();
    await expect(page.locator("[data-testid='list-view']")).toBeVisible();
    // Click first task row to open detail panel
    const firstRow = page.locator("[data-testid='task-row']").first();
    await expect(firstRow).toBeVisible();
    await firstRow.click();
    // Detail panel should appear
    await expect(page.locator("[data-testid='task-detail-panel']")).toBeVisible({ timeout: 5000 });
  });

  test("can close task detail panel", async ({ page }) => {
    await page.locator("[data-testid='nav-item-list']").click();
    await expect(page.locator("[data-testid='list-view']")).toBeVisible();
    await page.locator("[data-testid='task-row']").first().click();
    await expect(page.locator("[data-testid='task-detail-panel']")).toBeVisible({ timeout: 5000 });
    // Close the detail panel
    await page.locator("[data-testid='task-detail-close']").click();
    await expect(page.locator("[data-testid='task-detail-panel']")).not.toBeVisible();
  });

  test("can search and filter tasks", async ({ page }) => {
    await page.locator("[data-testid='topbar-search-input']").fill("Gantt");
    // Wait for debounce and re-render
    await page.waitForTimeout(500);
    // Switch to list view to see filtered results
    await page.locator("[data-testid='nav-item-list']").click();
    await expect(page.locator("[data-testid='list-view']")).toBeVisible();
    const filteredRows = page.locator("[data-testid='task-row']");
    await expect(filteredRows.count()).resolves.toBeLessThan(5);
  });

  test("can clear search to restore full task list", async ({ page }) => {
    await page.locator("[data-testid='topbar-search-input']").fill("Gantt");
    await page.waitForTimeout(500);
    await page.locator("[data-testid='topbar-search-clear']").click();
    await page.waitForTimeout(500);
    await page.locator("[data-testid='nav-item-list']").click();
    await expect(page.locator("[data-testid='task-row']")).toHaveCount(5);
  });

  test("can switch between views without losing data", async ({ page }) => {
    // Start in workspace view (default)
    await expect(page.locator("[data-testid='view-workspace']")).toBeVisible();
    // Switch to list
    await page.locator("[data-testid='nav-item-list']").click();
    await expect(page.locator("[data-testid='list-view']")).toBeVisible();
    await expect(page.locator("[data-testid='task-row']")).toHaveCount(5);
    // Switch to kanban
    await page.locator("[data-testid='nav-item-kanban']").click();
    await expect(page.locator("[data-testid='kanban-view']")).toBeVisible();
    // Switch back to workspace
    await page.locator("[data-testid='nav-item-workspace']").click();
    await expect(page.locator("[data-testid='view-workspace']")).toBeVisible();
  });
});
