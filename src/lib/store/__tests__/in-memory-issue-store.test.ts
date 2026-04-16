import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryIssueStore } from "../in-memory-issue-store";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { PersonRef } from "@/features/people/types";

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

function createTestProject(
  overrides: Partial<WorkspaceProject> = {},
): WorkspaceProject {
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

describe("InMemoryIssueStore", () => {
  let store: InMemoryIssueStore;

  beforeEach(async () => {
    store = new InMemoryIssueStore();
    await store.initialize({});
  });

  describe("capabilities", () => {
    it("reports correct capabilities", () => {
      expect(store.backendId).toBe("in-memory");
      expect(store.capabilities.supportsOffline).toBe(true);
      expect(store.capabilities.supportsDeltaQuery).toBe(false);
      expect(store.capabilities.supportsHierarchy).toBe(true);
      expect(store.capabilities.writeLatency).toBe("immediate");
    });
  });

  describe("task CRUD", () => {
    it("creates and retrieves a task", async () => {
      const task = await store.createTask({
        title: "New Task",
        status: "planned",
        priority: "high",
      });

      expect(task.title).toBe("New Task");
      expect(task.status).toBe("planned");
      expect(task.priority).toBe("high");

      const fetched = await store.getTask(task.id);
      expect(fetched).toEqual(task);
    });

    it("returns null for nonexistent task", async () => {
      const result = await store.getTask("nonexistent");
      expect(result).toBeNull();
    });

    it("creates task with defaults", async () => {
      const task = await store.createTask({ title: "Minimal" });
      expect(task.status).toBe("backlog");
      expect(task.priority).toBe("medium");
      expect(task.labels).toEqual([]);
    });

    it("updates a task", async () => {
      const task = await store.createTask({ title: "Original" });
      const updated = await store.updateTask(task.id, {
        title: "Updated",
        status: "in-progress",
        labels: ["bug", "urgent"],
      });

      expect(updated.title).toBe("Updated");
      expect(updated.status).toBe("in-progress");
      expect(updated.labels).toEqual(["bug", "urgent"]);
      expect(updated.priority).toBe("medium"); // unchanged
    });

    it("clears nullable fields with null", async () => {
      const task = await store.createTask({
        title: "With date",
        dueDate: "2026-12-31",
        projectId: "proj-1",
      });
      expect(task.dueDate).toBe("2026-12-31");

      const updated = await store.updateTask(task.id, {
        dueDate: null,
        projectId: null,
      });
      expect(updated.dueDate).toBeUndefined();
      expect(updated.projectId).toBeUndefined();
    });

    it("throws when updating nonexistent task", async () => {
      await expect(
        store.updateTask("nonexistent", { title: "Nope" }),
      ).rejects.toThrow('Task "nonexistent" not found');
    });

    it("deletes a task", async () => {
      const task = await store.createTask({ title: "To Delete" });
      await store.deleteTask(task.id);
      expect(await store.getTask(task.id)).toBeNull();
    });

    it("throws when deleting nonexistent task", async () => {
      await expect(store.deleteTask("nonexistent")).rejects.toThrow(
        'Task "nonexistent" not found',
      );
    });
  });

  describe("task queries", () => {
    beforeEach(() => {
      store.seedTask(createTestTask({ id: "t1", title: "Alpha", status: "backlog", priority: "low", projectId: "p1", sortOrder: 2 }));
      store.seedTask(createTestTask({ id: "t2", title: "Beta", status: "in-progress", priority: "high", projectId: "p1", sortOrder: 0 }));
      store.seedTask(createTestTask({ id: "t3", title: "Gamma", status: "done", priority: "medium", projectId: "p2", sortOrder: 1 }));
      store.seedTask(createTestTask({ id: "t4", title: "Delta search target", status: "planned", labels: ["bug"], sortOrder: 3 }));
    });

    it("lists all open tasks by default", async () => {
      const result = await store.listTasks({});
      expect(result.items).toHaveLength(3); // excludes "done"
    });

    it("includes completed when requested", async () => {
      const result = await store.listTasks({ includeCompleted: true });
      expect(result.items).toHaveLength(4);
    });

    it("filters by project", async () => {
      const result = await store.listTasks({ projectId: "p1", includeCompleted: true });
      expect(result.items).toHaveLength(2);
      expect(result.items.every((t) => t.projectId === "p1")).toBe(true);
    });

    it("filters by status", async () => {
      const result = await store.listTasks({ statuses: ["backlog", "planned"], includeCompleted: true });
      expect(result.items).toHaveLength(2);
    });

    it("filters by labels", async () => {
      const result = await store.listTasks({ labels: ["bug"], includeCompleted: true });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("t4");
    });

    it("searches by title and description", async () => {
      const result = await store.listTasks({ search: "search target", includeCompleted: true });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("t4");
    });

    it("sorts by sortOrder ascending by default", async () => {
      const result = await store.listTasks({ includeCompleted: true });
      expect(result.items.map((t) => t.id)).toEqual(["t2", "t3", "t1", "t4"]);
    });

    it("paginates results", async () => {
      const page1 = await store.listTasks({ includeCompleted: true, offset: 0, limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.hasMore).toBe(true);
      expect(page1.total).toBe(4);

      const page2 = await store.listTasks({ includeCompleted: true, offset: 2, limit: 2 });
      expect(page2.items).toHaveLength(2);
      expect(page2.hasMore).toBe(false);
    });
  });

  describe("project operations", () => {
    beforeEach(() => {
      store.seedProject(createTestProject({ id: "p1", title: "Active Project", status: "active" }));
      store.seedProject(createTestProject({ id: "p2", title: "Completed", status: "complete" }));
      store.seedProject(createTestProject({ id: "p3", title: "Child", status: "active", parentProjectId: "p1" }));
    });

    it("lists open projects by default", async () => {
      const result = await store.listProjects({});
      expect(result.items).toHaveLength(2); // excludes "complete"
    });

    it("includes completed projects", async () => {
      const result = await store.listProjects({ includeCompleted: true });
      expect(result.items).toHaveLength(3);
    });

    it("filters by parent project", async () => {
      const result = await store.listProjects({ parentProjectId: "p1", includeCompleted: true });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("p3");
    });

    it("retrieves a single project", async () => {
      const project = await store.getProject("p1");
      expect(project?.title).toBe("Active Project");
    });

    it("returns null for nonexistent project", async () => {
      expect(await store.getProject("nonexistent")).toBeNull();
    });
  });

  describe("comment operations", () => {
    it("creates and retrieves comments", async () => {
      const task = await store.createTask({ title: "Commented Task" });

      const comment = await store.createComment({
        entityType: "task",
        entityId: task.id,
        body: "First comment",
        bodyFormat: "markdown",
      });

      expect(comment.body).toBe("First comment");
      expect(comment.bodyFormat).toBe("markdown");
      expect(comment.entityId).toBe(task.id);

      const comments = await store.listComments(task.id);
      expect(comments).toHaveLength(1);
      expect(comments[0]).toEqual(comment);
    });

    it("returns empty for entity with no comments", async () => {
      const comments = await store.listComments("no-comments");
      expect(comments).toEqual([]);
    });
  });

  describe("people", () => {
    it("returns seeded people", async () => {
      store.seedPerson(createTestPerson({ id: "p1", displayName: "Alice" }));
      store.seedPerson(createTestPerson({ id: "p2", displayName: "Bob" }));

      const people = await store.listPeople();
      expect(people).toHaveLength(2);
    });
  });

  describe("sync", () => {
    it("returns a watermark", async () => {
      const wm = await store.getWatermark();
      expect(wm.backendId).toBe("in-memory");
      expect(wm.timestamp).toBeTruthy();
    });

    it("throws on getChangesSince (not supported)", async () => {
      await expect(
        store.getChangesSince({ backendId: "in-memory", timestamp: "" }),
      ).rejects.toThrow("does not support delta queries");
    });
  });

  describe("dispose", () => {
    it("clears all data", async () => {
      store.seedTask(createTestTask({ id: "t1" }));
      store.seedProject(createTestProject({ id: "p1" }));

      await store.dispose();

      const tasks = await store.listTasks({ includeCompleted: true });
      const projects = await store.listProjects({ includeCompleted: true });
      expect(tasks.items).toHaveLength(0);
      expect(projects.items).toHaveLength(0);
    });
  });
});
