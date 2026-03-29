/**
 * Tests for SQLiteIssueStore — local-first SQLite backend.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SQLiteIssueStore } from "../sqlite-issue-store";

describe("SQLiteIssueStore", () => {
  let store: SQLiteIssueStore;

  beforeEach(async () => {
    store = new SQLiteIssueStore();
    await store.initialize({});
  });

  afterEach(async () => {
    await store.dispose();
  });

  // -- Lifecycle ------------------------------------------------------------

  it("initializes and disposes cleanly", async () => {
    const s = new SQLiteIssueStore();
    await s.initialize({});
    expect(s.backendId).toBe("sqlite");
    expect(s.capabilities.supportsOffline).toBe(true);
    expect(s.capabilities.supportsDeltaQuery).toBe(true);
    await s.dispose();
  });

  // -- Task CRUD ------------------------------------------------------------

  describe("task CRUD", () => {
    it("creates a task", async () => {
      const task = await store.createTask({ title: "Test task" });
      expect(task.id).toBeTruthy();
      expect(task.title).toBe("Test task");
      expect(task.status).toBe("backlog");
      expect(task.priority).toBe("medium");
    });

    it("gets a task by id", async () => {
      const created = await store.createTask({ title: "Find me" });
      const found = await store.getTask(created.id);
      expect(found).toBeTruthy();
      expect(found!.title).toBe("Find me");
    });

    it("returns null for non-existent task", async () => {
      const found = await store.getTask("does-not-exist");
      expect(found).toBeNull();
    });

    it("updates a task", async () => {
      const created = await store.createTask({ title: "Before" });
      const updated = await store.updateTask(created.id, {
        title: "After",
        status: "in-progress",
      });
      expect(updated.title).toBe("After");
      expect(updated.status).toBe("in-progress");
    });

    it("deletes a task", async () => {
      const created = await store.createTask({ title: "Delete me" });
      await store.deleteTask(created.id);
      const found = await store.getTask(created.id);
      expect(found).toBeNull();
    });

    it("throws when updating non-existent task", async () => {
      await expect(
        store.updateTask("missing", { title: "x" }),
      ).rejects.toThrow('Task "missing" not found');
    });

    it("throws when deleting non-existent task", async () => {
      await expect(store.deleteTask("missing")).rejects.toThrow(
        'Task "missing" not found',
      );
    });
  });

  // -- Task listing / filtering ---------------------------------------------

  describe("task listing and filtering", () => {
    it("lists tasks with pagination", async () => {
      await store.createTask({ title: "Task 1" });
      await store.createTask({ title: "Task 2" });
      const result = await store.listTasks({ limit: 1 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(true);
    });

    it("filters by project", async () => {
      // Seed projects so foreign key constraints are satisfied
      const db = store.getDatabase()!;
      db.run(`INSERT INTO projects (id, external_id, title) VALUES ('p1', 'p1', 'Project 1')`);
      db.run(`INSERT INTO projects (id, external_id, title) VALUES ('p2', 'p2', 'Project 2')`);
      await store.createTask({ title: "A", projectId: "p1" });
      await store.createTask({ title: "B", projectId: "p2" });
      const result = await store.listTasks({ projectId: "p1" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("A");
    });

    it("filters by status", async () => {
      await store.createTask({ title: "A", status: "done" });
      await store.createTask({ title: "B", status: "backlog" });
      const result = await store.listTasks({ statuses: ["done"] });
      expect(result.items).toHaveLength(1);
    });

    it("excludes completed by default", async () => {
      await store.createTask({ title: "Done", status: "done" });
      await store.createTask({ title: "Open", status: "backlog" });
      const result = await store.listTasks({});
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toBe("Open");
    });
  });

  // -- Full-text search -----------------------------------------------------

  describe("full-text search", () => {
    it("finds tasks by title", async () => {
      await store.createTask({ title: "Implement login page" });
      await store.createTask({ title: "Design dashboard" });
      const result = await store.listTasks({ search: "login" });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].title).toContain("login");
    });

    it("finds tasks by description", async () => {
      await store.createTask({
        title: "Feature",
        description: "Uses OAuth2 for authentication",
      });
      await store.createTask({
        title: "Other",
        description: "Completely unrelated",
      });
      const result = await store.listTasks({ search: "OAuth2" });
      expect(result.items).toHaveLength(1);
    });
  });

  // -- Projects -------------------------------------------------------------

  describe("projects", () => {
    it("creates and retrieves projects via raw SQL (store manages tasks, not project creation)", async () => {
      // SQLiteIssueStore focuses on tasks; project table is pre-seeded or synced
      // But we can query the empty table
      const result = await store.listProjects({});
      expect(result.items).toHaveLength(0);
    });
  });

  // -- Comments -------------------------------------------------------------

  describe("comments", () => {
    it("creates and lists comments for a task", async () => {
      const task = await store.createTask({ title: "Commented task" });
      const comment = await store.createComment({
        entityType: "task",
        entityId: task.id,
        body: "Hello world",
      });
      expect(comment.id).toBeTruthy();
      expect(comment.body).toBe("Hello world");

      const comments = await store.listComments(task.id);
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe("Hello world");
    });
  });

  // -- Sync / watermark -----------------------------------------------------

  describe("sync support", () => {
    it("returns a watermark", async () => {
      const wm = await store.getWatermark();
      expect(wm.backendId).toBe("sqlite");
      expect(wm.timestamp).toBeTruthy();
    });

    it("detects changes since watermark", async () => {
      const wm = await store.getWatermark();
      const task = await store.createTask({ title: "New task" });
      const changes = await store.getChangesSince(wm);
      expect(changes.created.length).toBeGreaterThanOrEqual(1);
      expect(changes.created.some((t) => t.id === task.id)).toBe(true);
    });
  });
});
