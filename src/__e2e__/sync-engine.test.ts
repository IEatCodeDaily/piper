/**
 * E2E: Sync Engine — Delta Detection & Watermark Management
 *
 * Tests the sync lifecycle using InMemoryIssueStore as both source and target:
 * - Watermark generation and progression
 * - Change detection (create, update, delete)
 * - Error paths for unsupported delta queries
 * - dispose clears sync state
 *
 * NEV-18 — Phase 1 hardening.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryIssueStore } from "@/lib/store/in-memory-issue-store";
import type { SyncWatermark, ChangeSet } from "@/lib/store/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { PersonRef } from "@/features/people/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTestPerson(overrides: Partial<PersonRef> = {}): PersonRef {
  return {
    id: "person-1",
    externalId: "person-1",
    displayName: "Test User",
    email: "test@example.com",
    ...overrides,
  };
}

function createTestTask(overrides: Partial<WorkspaceTask> = {}): WorkspaceTask {
  const person = createTestPerson();
  return {
    id: "task-1",
    externalId: "task-1",
    workspaceId: "ws-1",
    title: "Test Task",
    description: "Test description",
    status: "backlog",
    priority: "medium",
    labels: [],
    path: ["Test Task"],
    sortOrder: 0,
    watchers: [],
    checklist: [],
    attachments: [],
    commentIds: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    createdBy: person,
    modifiedBy: person,
    ...overrides,
  };
}

function createTestProject(overrides: Partial<WorkspaceProject> = {}): WorkspaceProject {
  const person = createTestPerson();
  return {
    id: "proj-1",
    externalId: "proj-1",
    workspaceId: "ws-1",
    projectCode: "PROJ-1",
    title: "Test Project",
    description: "A test project",
    status: "active",
    health: { status: "on-track", summary: "All good" },
    owner: person,
    collaborators: [],
    priority: "medium",
    progressPercent: 0,
    labels: [],
    path: ["Test Project"],
    milestoneIds: [],
    milestones: [],
    taskIds: [],
    taskCount: 0,
    openTaskCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("E2E: Sync Engine", () => {
  let store: InMemoryIssueStore;

  beforeEach(async () => {
    store = new InMemoryIssueStore();
    await store.initialize({});
  });

  // -------------------------------------------------------------------------
  // Watermark
  // -------------------------------------------------------------------------

  describe("watermark management", () => {
    it("generates a watermark with correct backendId", async () => {
      const wm = await store.getWatermark();
      expect(wm.backendId).toBe("in-memory");
      expect(wm.timestamp).toBeTruthy();
    });

    it("watermark timestamp advances over time", async () => {
      const wm1 = await store.getWatermark();
      // Small delay to ensure different timestamp
      await new Promise((r) => setTimeout(r, 10));
      const wm2 = await store.getWatermark();
      // Timestamps should be valid ISO strings
      expect(new Date(wm2.timestamp).getTime()).toBeGreaterThanOrEqual(
        new Date(wm1.timestamp).getTime(),
      );
    });

    it("watermark is stable across multiple reads", async () => {
      const wm1 = await store.getWatermark();
      const wm2 = await store.getWatermark();
      expect(wm1.backendId).toBe(wm2.backendId);
    });
  });

  // -------------------------------------------------------------------------
  // Delta query — InMemory doesn't support it
  // -------------------------------------------------------------------------

  describe("delta query support", () => {
    it("throws on getChangesSince for in-memory store", async () => {
      const watermark: SyncWatermark = {
        backendId: "in-memory",
        timestamp: new Date().toISOString(),
      };

      await expect(store.getChangesSince(watermark)).rejects.toThrow(
        "does not support delta queries",
      );
    });

    it("declares supportsDeltaQuery = false", () => {
      expect(store.capabilities.supportsDeltaQuery).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Manual change detection (simulating sync by comparing snapshots)
  // -------------------------------------------------------------------------

  describe("manual change detection", () => {
    it("can detect new tasks by comparing snapshots", async () => {
      // Snapshot 1: empty
      const before = await store.listTasks({ includeCompleted: true });
      expect(before.items).toHaveLength(0);

      // Add tasks
      store.seedTask(createTestTask({ id: "t1", title: "Task 1" }));
      store.seedTask(createTestTask({ id: "t2", title: "Task 2" }));

      // Snapshot 2
      const after = await store.listTasks({ includeCompleted: true });
      expect(after.items).toHaveLength(2);

      // Delta
      const newIds = after.items
        .filter((t) => !before.items.some((b) => b.id === t.id))
        .map((t) => t.id);
      expect(newIds).toEqual(["t1", "t2"]);
    });

    it("can detect deleted tasks by comparing snapshots", async () => {
      store.seedTask(createTestTask({ id: "t1" }));
      store.seedTask(createTestTask({ id: "t2" }));

      const before = await store.listTasks({ includeCompleted: true });

      await store.deleteTask("t1");

      const after = await store.listTasks({ includeCompleted: true });

      const deletedIds = before.items
        .filter((t) => !after.items.some((a) => a.id === t.id))
        .map((t) => t.id);
      expect(deletedIds).toEqual(["t1"]);
    });

    it("can detect updated tasks by comparing field values", async () => {
      store.seedTask(createTestTask({ id: "t1", title: "Original", status: "backlog" }));

      const before = await store.listTasks({ includeCompleted: true });

      await store.updateTask("t1", { title: "Updated", status: "in-progress" });

      const after = await store.listTasks({ includeCompleted: true });

      const changed = after.items.filter((a) => {
        const b = before.items.find((x) => x.id === a.id);
        if (!b) return false;
        return b.title !== a.title || b.status !== a.status;
      });
      expect(changed).toHaveLength(1);
      expect(changed[0].title).toBe("Updated");
      expect(changed[0].status).toBe("in-progress");
    });

    it("can detect new projects", async () => {
      const before = await store.listProjects({ includeCompleted: true });

      store.seedProject(createTestProject({ id: "p1", title: "New Project" }));

      const after = await store.listProjects({ includeCompleted: true });
      expect(after.items.length - before.items.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Store capabilities contract
  // -------------------------------------------------------------------------

  describe("store capabilities", () => {
    it("reports correct capabilities for in-memory store", () => {
      expect(store.backendId).toBe("in-memory");
      expect(store.capabilities.supportsOffline).toBe(true);
      expect(store.capabilities.supportsDeltaQuery).toBe(false);
      expect(store.capabilities.supportsWebhooks).toBe(false);
      expect(store.capabilities.supportsBatchOperations).toBe(false);
      expect(store.capabilities.supportsRichText).toBe(false);
      expect(store.capabilities.supportsHierarchy).toBe(true);
      expect(store.capabilities.maxPageSize).toBe(1000);
      expect(store.capabilities.writeLatency).toBe("immediate");
    });
  });

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  describe("lifecycle", () => {
    it("can re-initialize after dispose", async () => {
      store.seedTask(createTestTask({ id: "t1" }));
      await store.dispose();

      const tasksAfterDispose = await store.listTasks({ includeCompleted: true });
      expect(tasksAfterDispose.items).toHaveLength(0);

      // Re-init
      await store.initialize({});
      store.seedTask(createTestTask({ id: "t2" }));
      const tasksAfterReinit = await store.listTasks({ includeCompleted: true });
      expect(tasksAfterReinit.items).toHaveLength(1);
    });
  });
});
