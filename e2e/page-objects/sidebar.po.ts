/**
 * Page Object: Sidebar
 *
 * Encapsulates interactions with the Piper sidebar including workspace
 * switching, navigation between views, and the quick-create button.
 */
import type { Page, Locator } from "@playwright/test";

export class SidebarPage {
  readonly page: Page;
  readonly root: Locator;
  readonly workspaceSwitcher: Locator;
  readonly quickCreateButton: Locator;
  readonly importConfigButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("[data-testid='sidebar']");
    this.workspaceSwitcher = page.locator("[data-testid='workspace-switcher']");
    this.quickCreateButton = page.locator("[data-testid='quick-create-button']");
    this.importConfigButton = page.locator("[data-testid='import-config-button']");
  }

  async selectView(viewName: string) {
    await this.root.locator(`[data-testid='nav-item-${viewName}']`).click();
  }

  async selectWorkspace(workspaceName: string) {
    await this.workspaceSwitcher.click();
    await this.page.locator(`[data-testid='workspace-option-${workspaceName}']`).click();
  }
}
