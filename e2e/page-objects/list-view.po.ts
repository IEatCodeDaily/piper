/**
 * Page Object: List View
 *
 * Encapsulates interactions with the task list/table view.
 */
import type { Page, Locator } from "@playwright/test";

export class ListViewPage {
  readonly page: Page;
  readonly root: Locator;
  readonly tableRows: Locator;
  readonly columnHeader: (name: string) => Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("[data-testid='list-view']");
    this.tableRows = this.root.locator("[data-testid='task-row']");
    this.columnHeader = (name: string) =>
      this.root.locator(`[data-testid='header-${name}']`);
  }

  async getTaskRowByTitle(title: string): Promise<Locator> {
    return this.root.locator(`[data-testid='task-row']`, {
      hasText: title,
    });
  }

  async getTaskCount(): Promise<number> {
    return this.tableRows.count();
  }

  async clickTask(title: string) {
    const row = await this.getTaskRowByTitle(title);
    await row.click();
  }

  async sortBy(columnName: string) {
    await this.columnHeader(columnName).click();
  }
}
