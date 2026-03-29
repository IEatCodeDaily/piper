/**
 * Page Object: Kanban View
 *
 * Encapsulates interactions with the Kanban board view.
 */
import type { Page, Locator } from "@playwright/test";

export class KanbanViewPage {
  readonly page: Page;
  readonly root: Locator;
  readonly columns: Locator;
  readonly cards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator("[data-testid='kanban-view']");
    this.columns = this.root.locator("[data-testid='kanban-column']");
    this.cards = this.root.locator("[data-testid='kanban-card']");
  }

  async getColumnByTitle(title: string): Promise<Locator> {
    return this.root.locator(`[data-testid='kanban-column']`, { hasText: title });
  }

  async getCardByTitle(title: string): Promise<Locator> {
    return this.root.locator(`[data-testid='kanban-card']`, { hasText: title });
  }

  async getColumnCount(): Promise<number> {
    return this.columns.count();
  }

  async getCardCount(): Promise<number> {
    return this.cards.count();
  }
}
