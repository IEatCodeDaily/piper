import { test, expect } from "./fixtures";

test.describe("Smoke tests", () => {
  test("app loads and shows the Piper shell", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();
    await expect(page.locator("[data-testid='sidebar']")).toBeVisible();
    await expect(page.locator("[data-testid='topbar']")).toBeVisible();
  });

  test("workspace data loads from mock backend", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();
    // The topbar title contains workspace name from mock data: "Core Operations · Workspace stream"
    const title = page.locator("[data-testid='topbar-title']");
    await expect(title).toContainText("Core Operations");
  });

  test("list view renders tasks from fixtures", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();
    // Navigate to list view
    await page.locator("[data-testid='nav-item-list']").click();
    // Wait for lazy-loaded list view to mount (wrapped in view-list, inner has list-view)
    await expect(page.locator("[data-testid='view-list']")).toBeVisible();
    await expect(page.locator("[data-testid='list-view']")).toBeVisible();
    // Should have 5 task rows from mock data
    const rows = page.locator("[data-testid='list-view'] [data-testid='task-row']");
    await expect(rows).toHaveCount(5);
  });

  test("kanban view renders with status columns", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();
    await page.locator("[data-testid='nav-item-kanban']").click();
    await expect(page.locator("[data-testid='kanban-view']")).toBeVisible();
    const columns = page.locator("[data-testid='kanban-column']");
    await expect(columns).toHaveCount(4);
  });

  test("workspace stream view shows all tasks", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();
    // Default view is workspace stream
    await expect(page.locator("[data-testid='view-workspace']")).toBeVisible();
    const rows = page.locator("[data-testid='task-row']");
    await expect(rows).toHaveCount(5);
  });
});
