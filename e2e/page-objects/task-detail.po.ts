/**
 * Page Object: Task Detail Panel
 *
 * Encapsulates interactions with the right-rail task detail panel.
 */
import type { Page, Locator } from "@playwright/test";

export class TaskDetailPage {
  readonly page: Page;
  readonly root: Locator;
  readonly title: Locator;
  readonly closeButton: Locator;
  readonly description: Locator;
  readonly statusCell: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("[data-testid='task-detail-panel']");
    this.title = this.root.locator("[data-testid='task-detail-title']");
    this.closeButton = this.root.locator("[data-testid='task-detail-close']");
    this.description = this.root.locator("[data-testid='task-detail-description']");
    this.statusCell = this.root.locator("[data-testid='task-detail-status']");
  }

  async close() {
    await this.closeButton.click();
  }

  async isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }
}
