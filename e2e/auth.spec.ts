import { test, expect } from "./fixtures";

test.describe("Auth flow", () => {
  test("shows runtime controls when no task is selected", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();
    // In mock mode, runtime controls should be visible in the right rail
    await expect(page.getByText("Repository mode", { exact: true })).toBeVisible();
  });

  test("runtime controls show repository mode buttons", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();
    await expect(page.getByRole("button", { name: "Mock", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Graph Mock" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Graph Live" })).toBeVisible();
  });

  test("can switch repository mode", async ({ page, waitForAppReady }) => {
    await page.goto("/");
    await waitForAppReady();
    // Click "Graph Mock" mode
    await page.getByRole("button", { name: "Graph Mock" }).click();
    // The mock mode button should still be visible
    const mockButton = page.getByRole("button", { name: "Mock", exact: true });
    await expect(mockButton).toBeVisible();
  });
});
