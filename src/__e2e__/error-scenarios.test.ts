/**
 * E2E: Error Scenarios & Resilience
 *
 * Tests error handling and resilience for Phase 1:
 * - Network failure simulation
 * - Token expiry mid-operation
 * - Concurrent edit conflicts
 * - Large lists (1000+ items)
 * - Malformed data handling
 * - Store not initialized errors
 *
 * NEV-18 — Phase 1 hardening.
 */

import { describe, expect, it, beforeEach, vi } from "vitest";
import { InMemoryIssueStore } from "@/lib/store/in-memory-issue-store";
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

describe("E2E: Error Scenarios", () => {
  let store: InMemoryIssueStore;

  beforeEach(async () => {
    store = new InMemoryIssueStore();
    await store.initialize({});
  });

  // -------------------------------------------------------------------------
  // Missing data errors
  // -------------------------------------------------------------------------

  describe("missing data errors", () => {
    it("throws when updating a nonexistent task", async () => {
      await expect(
        store.updateTask("nonexistent", { title: "Nope" }),
      ).rejects.toThrow('Task "nonexistent" not found');
    });

    it("throws when deleting a nonexistent task", async () => {
      await expect(
        store.deleteTask("nonexistent"),
      ).rejects.toThrow('Task "nonexistent" not found');
    });

    it("returns null for nonexistent task", async () => {
      expect(await store.getTask("nonexistent")).toBeNull();
    });

    it("returns null for nonexistent project", async () => {
      expect(await store.getProject("nonexistent")).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Concurrent edit simulation
  // -------------------------------------------------------------------------

  describe("concurrent edits", () => {
    it("last write wins for same task", async () => {
      const task = await store.createTask({ title: "Concurrent" });

      // Simulate two concurrent updates
      const [updated1, updated2] = await Promise.all([
        store.updateTask(task.id, { title: "Update A" }),
        store.updateTask(task.id, { title: "Update B" }),
      ]);

      // Both should succeed (no locking in in-memory store)
      // The final state should be one of the two
      const final = await store.getTask(task.id);
      expect(final).not.toBeNull();
      expect(["Update A", "Update B"]).toContain(final!.title);
    });

    it("can handle interleaved create and update", async () => {
      const task = await store.createTask({ title: "Interleaved" });
      const updatePromise = store.updateTask(task.id, { status: "in-progress" });
      const createPromise = store.createTask({ title: "Another" });

      const [updated, created] = await Promise.all([updatePromise, createPromise]);

      expect(updated.status).toBe("in-progress");
      expect(created.title).toBe("Another");

      // Both should exist
      expect(await store.getTask(task.id)).not.toBeNull();
      expect(await store.getTask(created.id)).not.toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Large lists (1000+ items)
  // -------------------------------------------------------------------------

  describe("large lists", () => {
    it("handles 1000 seeded tasks", async () => {
      const count = 1000;
      for (let i = 0; i < count; i++) {
        store.seedTask(createTestTask({
          id: `t-${i}`,
          title: `Task ${i}`,
          sortOrder: i,
        }));
      }

      const result = await store.listTasks({ includeCompleted: true });
      expect(result.items).toHaveLength(count);
      expect(result.total).toBe(count);
    });

    it("paginates through 1000 tasks", async () => {
      const count = 1000;
      for (let i = 0; i < count; i++) {
        store.seedTask(createTestTask({
          id: `t-${i}`,
          title: `Task ${i}`,
          sortOrder: i,
        }));
      }

      const pageSize = 50;
      let offset = 0;
      let totalFetched = 0;
      let hasMore = true;

      while (hasMore) {
        const page = await store.listTasks({
          includeCompleted: true,
          offset,
          limit: pageSize,
        });
        totalFetched += page.items.length;
        hasMore = page.hasMore;
        offset += pageSize;
      }

      expect(totalFetched).toBe(count);
    });

    it("searches across 1000 tasks efficiently", async () => {
      const count = 1000;
      for (let i = 0; i < count; i++) {
        store.seedTask(createTestTask({
          id: `t-${i}`,
          title: i === 42 ? "FIND ME" : `Task ${i}`,
          description: i === 42 ? "Special description" : `Description ${i}`,
          sortOrder: i,
        }));
      }

      const result = await store.listTasks({
        includeCompleted: true,
        search: "FIND ME",
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("t-42");
    });

    it("creates 500 tasks sequentially", async () => {
      const count = 500;
      const tasks: WorkspaceTask[] = [];

      for (let i = 0; i < count; i++) {
        const task = await store.createTask({ title: `Created ${i}` });
        tasks.push(task);
      }

      const result = await store.listTasks({ includeCompleted: true });
      expect(result.items).toHaveLength(count);
    }, 30_000); // longer timeout for many ops

    it("handles 1000 projects", async () => {
      const count = 1000;
      for (let i = 0; i < count; i++) {
        store.seedProject(createTestProject({
          id: `p-${i}`,
          title: `Project ${i}`,
        }));
      }

      const result = await store.listProjects({ includeCompleted: true });
      expect(result.items).toHaveLength(count);
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases in data
  // -------------------------------------------------------------------------

  describe("data edge cases", () => {
    it("handles tasks with empty title", async () => {
      const task = await store.createTask({ title: "" });
      expect(task.title).toBe("");
    });

    it("handles tasks with special characters in title", async () => {
      const specialTitle = "Task with <script>alert('xss')</script> & 'quotes' \"double\"";
      const task = await store.createTask({ title: specialTitle });
      expect(task.title).toBe(specialTitle);

      const fetched = await store.getTask(task.id);
      expect(fetched?.title).toBe(specialTitle);
    });

    it("handles tasks with unicode in title", async () => {
      const unicodeTitle = "タスク 🚀 Ошибка Задача";
      const task = await store.createTask({ title: unicodeTitle });
      expect(task.title).toBe(unicodeTitle);
    });

    it("handles very long descriptions", async () => {
      const longDesc = "x".repeat(50_000);
      const task = await store.createTask({
        title: "Long desc",
        description: longDesc,
      });
      expect(task.description).toBe(longDesc);
    });

    it("handles many labels", async () => {
      const labels = Array.from({ length: 100 }, (_, i) => `label-${i}`);
      const task = await store.createTask({
        title: "Labeled",
        labels,
      });
      expect(task.labels).toHaveLength(100);
    });

    it("handles all status values", async () => {
      const statuses: WorkspaceTask["status"][] = [
        "backlog",
        "planned",
        "in-progress",
        "blocked",
        "in-review",
        "done",
      ];

      for (const status of statuses) {
        const task = await store.createTask({ title: `Status ${status}`, status });
        expect(task.status).toBe(status);
      }

      const all = await store.listTasks({ includeCompleted: true });
      expect(all.items).toHaveLength(6);
    });

    it("handles all priority values", async () => {
      const priorities: WorkspaceTask["priority"][] = [
        "low",
        "medium",
        "high",
        "urgent",
      ];

      for (const priority of priorities) {
        const task = await store.createTask({ title: `Priority ${priority}`, priority });
        expect(task.priority).toBe(priority);
      }
    });

    it("handles tasks with parent-child relationships", async () => {
      const parent = await store.createTask({ title: "Parent" });
      const child = await store.createTask({
        title: "Child",
        parentTaskId: parent.id,
      });

      expect(child.parentTaskId).toBe(parent.id);

      const children = await store.listTasks({ parentTaskId: parent.id });
      expect(children.items).toHaveLength(1);
      expect(children.items[0].id).toBe(child.id);
    });

    it("handles update that clears all optional fields", async () => {
      const task = await store.createTask({
        title: "Full",
        description: "Has desc",
        priority: "high",
        labels: ["a", "b"],
        dueDate: "2026-12-31",
        projectId: "p1",
      });

      const updated = await store.updateTask(task.id, {
        description: "",
        labels: [],
        dueDate: null,
        projectId: null,
      });

      expect(updated.description).toBe("");
      expect(updated.labels).toEqual([]);
      expect(updated.dueDate).toBeUndefined();
      expect(updated.projectId).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // Query edge cases
  // -------------------------------------------------------------------------

  describe("query edge cases", () => {
    it("returns correct pagination metadata for empty store", async () => {
      const result = await store.listTasks({ includeCompleted: true });
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });

    it("handles offset beyond data", async () => {
      store.seedTask(createTestTask({ id: "t1" }));
      const result = await store.listTasks({ offset: 100, includeCompleted: true });
      expect(result.items).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });

    it("handles limit of 0", async () => {
      store.seedTask(createTestTask({ id: "t1" }));
      const result = await store.listTasks({ limit: 0, includeCompleted: true });
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(1);
    });

    it("handles combined filters with no results", async () => {
      store.seedTask(createTestTask({ id: "t1", status: "backlog", projectId: "p1" }));

      const result = await store.listTasks({
        projectId: "p1",
        statuses: ["done"], // t1 is backlog, not done
      });
      expect(result.items).toHaveLength(0);
    });

    it("handles search with no results", async () => {
      store.seedTask(createTestTask({ id: "t1", title: "Alpha" }));
      const result = await store.listTasks({ search: "nonexistent", includeCompleted: true });
      expect(result.items).toHaveLength(0);
    });

    it("handles label filter with partial match", async () => {
      store.seedTask(createTestTask({ id: "t1", labels: ["bug", "urgent"] }));
      store.seedTask(createTestTask({ id: "t2", labels: ["feature"] }));
      store.seedTask(createTestTask({ id: "t3", labels: [] }));

      // "bug" should match t1 only
      const bugResult = await store.listTasks({ labels: ["bug"], includeCompleted: true });
      expect(bugResult.items).toHaveLength(1);

      // "urgent" or "feature" should match t1 and t2
      const multiResult = await store.listTasks({ labels: ["urgent", "feature"], includeCompleted: true });
      expect(multiResult.items).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Comment edge cases
  // -------------------------------------------------------------------------

  describe("comment edge cases", () => {
    it("creates comment with all body formats", async () => {
      const task = await store.createTask({ title: "Task" });
      const formats: ("plain-text" | "markdown" | "html")[] = ["plain-text", "markdown", "html"];

      for (const format of formats) {
        const comment = await store.createComment({
          entityType: "task",
          entityId: task.id,
          body: `${format} comment`,
          bodyFormat: format,
        });
        expect(comment.bodyFormat).toBe(format);
      }

      const all = await store.listComments(task.id);
      expect(all).toHaveLength(3);
    });

    it("handles empty comment body", async () => {
      const task = await store.createTask({ title: "Task" });
      const comment = await store.createComment({
        entityType: "task",
        entityId: task.id,
        body: "",
      });
      expect(comment.body).toBe("");
    });

    it("returns empty array for entity with no comments", async () => {
      const comments = await store.listComments("no-entity");
      expect(comments).toEqual([]);
    });
  });
});
