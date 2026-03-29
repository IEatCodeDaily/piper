/**
 * Page Object: Topbar
 *
 * Encapsulates interactions with the Piper topbar (title, search, metrics).
 */
import type { Page, Locator } from "@playwright/test";

export class TopbarPage {
  readonly page: Page;
  readonly root: Locator;
  readonly title: Locator;
  readonly eyebrow: Locator;
  readonly searchInput: Locator;
  readonly searchClearButton: Locator;
  readonly importConfigButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("[data-testid='topbar']");
    this.title = page.locator("[data-testid='topbar-title']");
    this.eyebrow = page.locator("[data-testid='topbar-eyebrow']");
    this.searchInput = page.locator("[data-testid='topbar-search-input']");
    this.searchClearButton = page.locator("[data-testid='topbar-search-clear']");
    this.importConfigButton = page.locator("[data-testid='import-config-topbar-button']");
  }

  async search(query: string) {
    await this.searchInput.fill(query);
  }

  async clearSearch() {
    await this.searchClearButton.click();
  }
}
