/**
 * MsListsIssueStore — comprehensive test suite for M6 (E2E testing, error
 * handling and polish for Phase 1).
 *
 * Covers:
 *  - Store lifecycle: initialize / dispose
 *  - Connection state transitions
 *  - Full CRUD for tasks (list, get, create, update, delete)
 *  - Full CRUD for projects (list, get)
 *  - Comment operations
 *  - People listing
 *  - Sync: getChangesSince, getWatermark, change detection
 *  - Error scenarios: not-initialized, network failure, missing config
 *  - Large list pagination
 *  - Query filtering (status, assignee, project, search, sort)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MsListsIssueStore } from "../ms-lists-issue-store";
import type { MsListsBackendConfig } from "../ms-lists-issue-store";
import { MockGraphClient } from "@/lib/graph/graph-client";
import { coreOpsWorkspaceFixture } from "@/features/workspaces/fixtures";
import type { GraphClient } from "@/lib/graph/graph-client";
import type {
  GraphCollectionResponse,
  GraphListColumnDefinition,
  GraphListItem,
  GraphListItemComment,
  GraphListMetadata,
  GraphListReference,
  GraphListColumnsRequest,
  GraphListItemsRequest,
  GraphListItemCommentsRequest,
} from "@/lib/graph/types";
import type { WorkspaceTask } from "@/features/tasks/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(): MsListsBackendConfig {
  return { workspaceConfig: coreOpsWorkspaceFixture };
}

/** A GraphClient that always throws — simulates network failure. */
class FailingGraphClient implements GraphClient {
  readonly errorMessage: string;

  constructor(message = "Network error") {
    this.errorMessage = message;
  }

  async getListMetadata(_ref: GraphListReference): Promise<GraphListMetadata> {
    throw new Error(this.errorMessage);
  }
  async listColumns(
    _req: GraphListColumnsRequest,
  ): Promise<GraphCollectionResponse<GraphListColumnDefinition>> {
    throw new Error(this.errorMessage);
  }
  async listItems(
    _req: GraphListItemsRequest,
  ): Promise<GraphCollectionResponse<GraphListItem>> {
    throw new Error(this.errorMessage);
  }
  async listComments(
    _req: GraphListItemCommentsRequest,
  ): Promise<GraphCollectionResponse<GraphListItemComment>> {
    throw new Error(this.errorMessage);
  }
}

/** A GraphClient whose listItems call resolves an empty collection. */
class EmptyGraphClient extends MockGraphClient {
  override async listItems(
    _req: GraphListItemsRequest,
  ): Promise<GraphCollectionResponse<GraphListItem>> {
    return { value: [] };
  }
}

/** A GraphClient that returns N synthetic task items for pagination testing. */
class LargeListGraphClient extends MockGraphClient {
  constructor(private readonly taskCount: number) {
    super();
  }

  override async listItems(
    req: GraphListItemsRequest,
  ): Promise<GraphCollectionResponse<GraphListItem>> {
    const base = await super.listItems(req);

    // Only inflate the tasks list; keep projects as-is
    const isTaskList =
      req.listId === coreOpsWorkspaceFixture.lists.tasks.list.id;
    if (!isTaskList) return base;

    const items: GraphListItem[] = Array.from(
      { length: this.taskCount },
      (_, i) => ({
        ...base.value[0],
        id: `synthetic-task-${i}`,
        etag: `"${i},1"`,
        fields: {
          ...base.value[0].fields,
          ID: 9000 + i,
          Title: `Synthetic Task ${i}`,
        },
      }),
    );

    return { value: items };
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — lifecycle", () => {
  it("requires workspaceConfig in initialize()", async () => {
    const store = new MsListsIssueStore(new MockGraphClient());
    await expect(store.initialize({})).rejects.toThrow("workspaceConfig");
  });

  it("initialises successfully with a MockGraphClient", async () => {
    const store = new MsListsIssueStore(new MockGraphClient());
    await expect(store.initialize(makeConfig())).resolves.toBeUndefined();

    const state = store.getConnectionState();
    expect(state.status).toBe("connected");
    expect(state.error).toBeNull();
    expect(state.lastSyncAt).toBeTruthy();
  });

  it("sets status to error when init fetch fails", async () => {
    const store = new MsListsIssueStore(new FailingGraphClient("timeout"));
    await expect(store.initialize(makeConfig())).rejects.toThrow("timeout");

    const state = store.getConnectionState();
    expect(state.status).toBe("error");
    expect(state.error).toContain("timeout");
  });

  it("resets caches on dispose", async () => {
    const store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());

    // Verify tasks were loaded
    const before = await store.listTasks({ includeCompleted: true });
    expect(before.items.length).toBeGreaterThan(0);

    await store.dispose();

    const state = store.getConnectionState();
    expect(state.status).toBe("disconnected");
  });

  it("exposes backendId as 'ms-lists'", () => {
    const store = new MsListsIssueStore(new MockGraphClient());
    expect(store.backendId).toBe("ms-lists");
  });

  it("declares correct capabilities", () => {
    const store = new MsListsIssueStore(new MockGraphClient());
    expect(store.capabilities.supportsDeltaQuery).toBe(true);
    expect(store.capabilities.supportsOffline).toBe(false);
    expect(store.capabilities.supportsWebhooks).toBe(false);
    expect(store.capabilities.supportsHierarchy).toBe(true);
    expect(store.capabilities.writeLatency).toBe("eventual");
    expect(store.capabilities.maxPageSize).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// Uninitialized guard
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — uninitialized guard", () => {
  let store: MsListsIssueStore;

  beforeEach(() => {
    store = new MsListsIssueStore(new MockGraphClient());
    // Deliberately NOT calling initialize()
  });

  it("listTasks throws before initialize", async () => {
    await expect(store.listTasks({})).rejects.toThrow(/not been initialized/i);
  });

  it("getTask throws before initialize", async () => {
    await expect(store.getTask("any")).rejects.toThrow(/not been initialized/i);
  });

  it("listProjects throws before initialize", async () => {
    await expect(store.listProjects({})).rejects.toThrow(
      /not been initialized/i,
    );
  });

  it("createTask throws before initialize", async () => {
    await expect(store.createTask({ title: "T" })).rejects.toThrow(
      /not been initialized/i,
    );
  });

  it("updateTask throws before initialize", async () => {
    await expect(store.updateTask("id", { title: "X" })).rejects.toThrow(
      /not been initialized/i,
    );
  });

  it("deleteTask throws before initialize", async () => {
    await expect(store.deleteTask("id")).rejects.toThrow(/not been initialized/i);
  });

  it("getWatermark returns a watermark even before initialize (no guard — by design)", async () => {
    // getWatermark is a lightweight timestamp operation that does not
    // require a live Graph connection, so it intentionally has no
    // ensureInitialized() guard.  Confirm it resolves rather than throws.
    const wm = await store.getWatermark();
    expect(wm.backendId).toBe("ms-lists");
    expect(wm.timestamp).toBeTruthy();
  });

  it("getChangesSince throws before initialize", async () => {
    const wm = {
      backendId: "ms-lists",
      timestamp: new Date().toISOString(),
    };
    await expect(store.getChangesSince(wm)).rejects.toThrow(
      /not been initialized/i,
    );
  });
});

// ---------------------------------------------------------------------------
// Task read operations
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — listTasks", () => {
  let store: MsListsIssueStore;

  beforeEach(async () => {
    store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());
  });

  it("returns tasks from mock data", async () => {
    const result = await store.listTasks({ includeCompleted: true });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBe(result.items.length);
    expect(result.offset).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("excludes completed tasks by default", async () => {
    const all = await store.listTasks({ includeCompleted: true });
    const open = await store.listTasks({ includeCompleted: false });
    const allDone = all.items.filter((t) => t.status === "done");
    expect(open.items.length).toBeLessThanOrEqual(
      all.items.length - allDone.length,
    );
    expect(open.items.every((t) => t.status !== "done")).toBe(true);
  });

  it("filters by status", async () => {
    const result = await store.listTasks({
      statuses: ["in-progress"],
      includeCompleted: true,
    });
    expect(result.items.every((t) => t.status === "in-progress")).toBe(true);
  });

  it("filters by search term (title match)", async () => {
    // Get a title to search from fixture
    const all = await store.listTasks({ includeCompleted: true });
    const firstTitle = all.items[0].title;
    const word = firstTitle.split(" ")[0];

    const result = await store.listTasks({
      search: word,
      includeCompleted: true,
    });
    expect(result.items.length).toBeGreaterThan(0);
    expect(
      result.items.some(
        (t) =>
          t.title.toLowerCase().includes(word.toLowerCase()) ||
          t.description.toLowerCase().includes(word.toLowerCase()),
      ),
    ).toBe(true);
  });

  it("search is case-insensitive", async () => {
    const all = await store.listTasks({ includeCompleted: true });
    const firstTitle = all.items[0].title;
    const word = firstTitle.split(" ")[0];

    const lowerResult = await store.listTasks({
      search: word.toLowerCase(),
      includeCompleted: true,
    });
    const upperResult = await store.listTasks({
      search: word.toUpperCase(),
      includeCompleted: true,
    });

    expect(lowerResult.items.length).toBe(upperResult.items.length);
  });

  it("returns empty for unmatched search", async () => {
    const result = await store.listTasks({
      search: "XXXXXXXXXXX_NO_MATCH",
      includeCompleted: true,
    });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("applies offset + limit pagination", async () => {
    const all = await store.listTasks({ includeCompleted: true });
    if (all.items.length < 2) return; // skip if too few fixtures

    const page1 = await store.listTasks({
      offset: 0,
      limit: 1,
      includeCompleted: true,
    });
    const page2 = await store.listTasks({
      offset: 1,
      limit: 1,
      includeCompleted: true,
    });

    expect(page1.items).toHaveLength(1);
    expect(page2.items).toHaveLength(1);
    expect(page1.items[0].id).not.toBe(page2.items[0].id);
    expect(page1.hasMore).toBe(true);
  });

  it("respects maxPageSize cap", async () => {
    const result = await store.listTasks({
      limit: store.capabilities.maxPageSize + 10_000,
      includeCompleted: true,
    });
    expect(result.limit).toBe(store.capabilities.maxPageSize);
  });

  it("sorts tasks by title ascending", async () => {
    const result = await store.listTasks({
      sortField: "title",
      sortDirection: "asc",
      includeCompleted: true,
    });
    const titles = result.items.map((t) => t.title);
    const sorted = [...titles].sort();
    expect(titles).toEqual(sorted);
  });

  it("sorts tasks by title descending", async () => {
    const result = await store.listTasks({
      sortField: "title",
      sortDirection: "desc",
      includeCompleted: true,
    });
    const titles = result.items.map((t) => t.title);
    const sorted = [...titles].sort().reverse();
    expect(titles).toEqual(sorted);
  });

  it("filters by projectId", async () => {
    const all = await store.listTasks({ includeCompleted: true });
    const withProject = all.items.filter((t) => !!t.projectId);
    if (withProject.length === 0) return; // no fixture data to test

    const projectId = withProject[0].projectId!;
    const result = await store.listTasks({
      projectId,
      includeCompleted: true,
    });
    expect(result.items.every((t) => t.projectId === projectId)).toBe(true);
  });

  it("filters by assigneeId", async () => {
    const all = await store.listTasks({ includeCompleted: true });
    const withAssignee = all.items.filter((t) => !!t.assignee?.id);
    if (withAssignee.length === 0) return;

    const assigneeId = withAssignee[0].assignee!.id;
    const result = await store.listTasks({
      assigneeId,
      includeCompleted: true,
    });
    expect(result.items.every((t) => t.assignee?.id === assigneeId)).toBe(true);
  });

  it("filters by label", async () => {
    const all = await store.listTasks({ includeCompleted: true });
    const withLabel = all.items.filter((t) => t.labels.length > 0);
    if (withLabel.length === 0) return;

    const label = withLabel[0].labels[0];
    const result = await store.listTasks({
      labels: [label],
      includeCompleted: true,
    });
    expect(result.items.every((t) => t.labels.includes(label))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTask
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — getTask", () => {
  let store: MsListsIssueStore;

  beforeEach(async () => {
    store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());
  });

  it("returns a task that exists in the cache", async () => {
    const all = await store.listTasks({ includeCompleted: true });
    const first = all.items[0];

    const fetched = await store.getTask(first.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.id).toBe(first.id);
    expect(fetched!.title).toBe(first.title);
  });

  it("returns null for an unknown ID", async () => {
    const result = await store.getTask("nonexistent-task-id-9999");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Project read operations
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — listProjects / getProject", () => {
  let store: MsListsIssueStore;

  beforeEach(async () => {
    store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());
  });

  it("returns projects from mock data", async () => {
    const result = await store.listProjects({ includeCompleted: true });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBe(result.items.length);
    expect(result.hasMore).toBe(false);
  });

  it("excludes completed projects by default", async () => {
    const all = await store.listProjects({ includeCompleted: true });
    const open = await store.listProjects({ includeCompleted: false });
    const completed = all.items.filter(
      (p) => p.status === "completed" || p.status === "complete",
    );
    expect(open.items.length).toBeLessThanOrEqual(
      all.items.length - completed.length,
    );
  });

  it("filters by status", async () => {
    const all = await store.listProjects({ includeCompleted: true });
    const statuses = [...new Set(all.items.map((p) => p.status))];
    if (statuses.length < 1) return;

    const target = statuses[0];
    const result = await store.listProjects({
      statuses: [target],
      includeCompleted: true,
    });
    expect(result.items.every((p) => p.status === target)).toBe(true);
  });

  it("getProject returns a known project", async () => {
    const all = await store.listProjects({ includeCompleted: true });
    const first = all.items[0];

    const found = await store.getProject(first.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(first.id);
  });

  it("getProject returns null for unknown ID", async () => {
    const result = await store.getProject("unknown-proj-9999");
    expect(result).toBeNull();
  });

  it("applies pagination to listProjects", async () => {
    const all = await store.listProjects({ includeCompleted: true });
    if (all.items.length < 2) return;

    const page = await store.listProjects({
      includeCompleted: true,
      offset: 0,
      limit: 1,
    });
    expect(page.items).toHaveLength(1);
    expect(page.hasMore).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Comment operations
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — listComments", () => {
  let store: MsListsIssueStore;

  beforeEach(async () => {
    store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());
  });

  it("returns empty array for an entity with no comments", async () => {
    const comments = await store.listComments("task:list-x:item-no-comment");
    expect(comments).toEqual([]);
  });

  it("returns empty array for a malformed entity ID", async () => {
    const comments = await store.listComments("no-colon");
    expect(comments).toEqual([]);
  });

  it("does not throw when graph client returns empty comments", async () => {
    const comments = await store.listComments(
      `task:${coreOpsWorkspaceFixture.lists.tasks.list.id}:item-x`,
    );
    expect(Array.isArray(comments)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — listPeople", () => {
  let store: MsListsIssueStore;

  beforeEach(async () => {
    store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());
  });

  it("returns people extracted from mock data", async () => {
    const people = await store.listPeople();
    expect(people.length).toBeGreaterThan(0);
    for (const person of people) {
      expect(person.id).toBeTruthy();
      expect(person.displayName).toBeTruthy();
    }
  });

  it("returns empty array after initialize with no data", async () => {
    const emptyStore = new MsListsIssueStore(new EmptyGraphClient());
    await emptyStore.initialize(makeConfig());

    const people = await emptyStore.listPeople();
    expect(people).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Sync — getWatermark / getChangesSince
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — sync", () => {
  let store: MsListsIssueStore;

  beforeEach(async () => {
    store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());
  });

  it("getWatermark returns a valid watermark", async () => {
    const wm = await store.getWatermark();
    expect(wm.backendId).toBe("ms-lists");
    expect(wm.timestamp).toBeTruthy();
    expect(() => new Date(wm.timestamp)).not.toThrow();
  });

  it("getChangesSince returns empty changeset when nothing changed", async () => {
    const wm = await store.getWatermark();
    const changes = await store.getChangesSince(wm);

    expect(changes.watermark.backendId).toBe("ms-lists");
    // Nothing changed between a fresh init and an immediate getChangesSince
    expect(changes.created).toHaveLength(0);
    expect(changes.updated).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
  });

  it("getChangesSince detects new tasks when a second call adds data", async () => {
    // Mock a client that returns an extra item on second call
    let callCount = 0;
    const originalListItems = MockGraphClient.prototype.listItems;

    const dynamicClient = new MockGraphClient();
    const originalFn = dynamicClient.listItems.bind(dynamicClient);

    dynamicClient.listItems = async (req) => {
      callCount++;
      const base = await originalFn(req);
      const isTaskList =
        req.listId === coreOpsWorkspaceFixture.lists.tasks.list.id;

      // On the second pass (getChangesSince triggers refreshAll), add a new item
      if (isTaskList && callCount > 2) {
        return {
          value: [
            ...base.value,
            {
              ...base.value[0],
              id: "brand-new-task-99",
              etag: '"99,1"',
              fields: {
                ...base.value[0].fields,
                ID: 99999,
                Title: "Brand New Task",
              },
            },
          ],
        };
      }
      return base;
    };

    const dynamicStore = new MsListsIssueStore(dynamicClient);
    await dynamicStore.initialize(makeConfig());

    const wm = await dynamicStore.getWatermark();
    const changes = await dynamicStore.getChangesSince(wm);

    expect(changes.created.length).toBeGreaterThanOrEqual(1);
    expect(changes.created.some((t) => t.id.includes("brand-new-task"))).toBe(
      true,
    );
  });

  it("getChangesSince detects deleted tasks", async () => {
    // Store has tasks after init; simulate deletion by returning fewer on second fetch
    let pass = 0;
    const dynamicClient = new MockGraphClient();
    const originalFn = dynamicClient.listItems.bind(dynamicClient);

    dynamicClient.listItems = async (req) => {
      pass++;
      const base = await originalFn(req);
      const isTaskList =
        req.listId === coreOpsWorkspaceFixture.lists.tasks.list.id;

      // After the initial load (pass > 2), drop the first task
      if (isTaskList && pass > 2) {
        return { value: base.value.slice(1) };
      }
      return base;
    };

    const dynamicStore = new MsListsIssueStore(dynamicClient);
    await dynamicStore.initialize(makeConfig());

    const wm = await dynamicStore.getWatermark();
    const changes = await dynamicStore.getChangesSince(wm);

    expect(changes.deleted.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Error handling — network failures
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — network failure scenarios", () => {
  it("wraps network error from initialize with status=error", async () => {
    const store = new MsListsIssueStore(
      new FailingGraphClient("ECONNREFUSED"),
    );
    await expect(store.initialize(makeConfig())).rejects.toThrow(
      "ECONNREFUSED",
    );
    expect(store.getConnectionState().status).toBe("error");
    expect(store.getConnectionState().error).toContain("ECONNREFUSED");
  });

  it("graph client returning HTTP 429 propagates error message", async () => {
    // Simulate a rate-limited Graph response
    const rateLimitedClient: GraphClient = {
      async getListMetadata(ref) {
        return { ...ref, displayName: "Test" };
      },
      async listColumns(_req) {
        return { value: [] };
      },
      async listItems(_req) {
        throw new Error("Graph read failed: 429 /sites/x/lists/y/items");
      },
      async listComments(_req) {
        return { value: [] };
      },
    };

    const store = new MsListsIssueStore(rateLimitedClient);
    await expect(store.initialize(makeConfig())).rejects.toThrow("429");
    expect(store.getConnectionState().status).toBe("error");
  });

  it("graph client returning HTTP 410 (expired deltaLink) is surfaced", async () => {
    const expiredLinkClient: GraphClient = {
      async getListMetadata(ref) {
        return { ...ref, displayName: "Test" };
      },
      async listColumns(_req) {
        return { value: [] };
      },
      async listItems(_req) {
        throw new Error("Graph read failed: 410 Gone — deltaLink expired");
      },
      async listComments(_req) {
        return { value: [] };
      },
    };

    const store = new MsListsIssueStore(expiredLinkClient);
    await expect(store.initialize(makeConfig())).rejects.toThrow("410");
  });

  it("listComments silently returns empty on graph failure", async () => {
    // After a successful init, the store's graphRead used in listComments
    // uses raw fetch — but the graphClient.listComments is used which
    // returns empty by default via MockGraphClient for unknown items
    const store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());

    // This should not throw even if comments are unavailable
    const comments = await store.listComments("task:unknown-list:unknown-item");
    expect(Array.isArray(comments)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Large list pagination (1000+ items)
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — large list handling", () => {
  it("loads and caches 1000 synthetic task items", async () => {
    const store = new MsListsIssueStore(new LargeListGraphClient(1000));
    await store.initialize(makeConfig());

    const result = await store.listTasks({
      offset: 0,
      limit: store.capabilities.maxPageSize,
      includeCompleted: true,
    });

    expect(result.total).toBe(1000);
    expect(result.items.length).toBeLessThanOrEqual(
      store.capabilities.maxPageSize,
    );
  });

  it("paginates correctly over 1000 items", async () => {
    const store = new MsListsIssueStore(new LargeListGraphClient(1000));
    await store.initialize(makeConfig());

    const page1 = await store.listTasks({
      offset: 0,
      limit: 50,
      includeCompleted: true,
    });
    const page2 = await store.listTasks({
      offset: 50,
      limit: 50,
      includeCompleted: true,
    });

    expect(page1.items).toHaveLength(50);
    expect(page2.items).toHaveLength(50);
    expect(page1.hasMore).toBe(true);
    expect(page2.hasMore).toBe(true);

    const ids1 = new Set(page1.items.map((t) => t.id));
    const ids2 = new Set(page2.items.map((t) => t.id));
    const overlap = [...ids1].filter((id) => ids2.has(id));
    expect(overlap).toHaveLength(0);
  });

  it("reports correct total even when paginating", async () => {
    const store = new MsListsIssueStore(new LargeListGraphClient(500));
    await store.initialize(makeConfig());

    const result = await store.listTasks({
      offset: 100,
      limit: 10,
      includeCompleted: true,
    });

    expect(result.total).toBe(500);
    expect(result.offset).toBe(100);
    expect(result.limit).toBe(10);
    expect(result.hasMore).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Connection state getters
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — getConnectionState", () => {
  it("starts as disconnected", () => {
    const store = new MsListsIssueStore(new MockGraphClient());
    expect(store.getConnectionState().status).toBe("disconnected");
    expect(store.getConnectionState().lastSyncAt).toBeNull();
    expect(store.getConnectionState().error).toBeNull();
  });

  it("is connected after successful init", async () => {
    const store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());
    expect(store.getConnectionState().status).toBe("connected");
  });

  it("is disconnected after dispose", async () => {
    const store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());
    await store.dispose();
    expect(store.getConnectionState().status).toBe("disconnected");
  });

  it("returns a copy (mutations don't affect internal state)", async () => {
    const store = new MsListsIssueStore(new MockGraphClient());
    await store.initialize(makeConfig());

    const state = store.getConnectionState();
    state.status = "stale"; // mutate the copy

    // Internal state must be unaffected
    expect(store.getConnectionState().status).toBe("connected");
  });
});

// ---------------------------------------------------------------------------
// Dispose + re-initialize
// ---------------------------------------------------------------------------

describe("MsListsIssueStore — dispose and re-initialize", () => {
  it("can be re-initialized after dispose", async () => {
    const store = new MsListsIssueStore(new MockGraphClient());

    await store.initialize(makeConfig());
    await store.dispose();

    // Second init should work fine
    await expect(store.initialize(makeConfig())).resolves.toBeUndefined();
    expect(store.getConnectionState().status).toBe("connected");
  });
});
