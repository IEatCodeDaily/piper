/**
 * E2E: CRUD Operations Through the Full Stack
 *
 * Tests end-to-end data flow:
 *   IssueStore -> IssueStoreRepository -> PiperRepository
 *
 * Verifies that tasks, projects, comments, and people flow correctly through
 * the adapter layer with the InMemoryIssueStore as a testable backend.
 *
 * NEV-18 — Phase 1 hardening.
 */

import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryIssueStore } from "@/lib/store/in-memory-issue-store";
import { IssueStoreRepository } from "@/lib/store/issue-store-repository";
import type { PiperRepository } from "@/lib/repository/piper-repository";
import type { PersonRef } from "@/features/people/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { WorkspaceProject } from "@/features/projects/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTestPerson(overrides: Partial<PersonRef> = {}): PersonRef {
  return {
    id: "person-1",
    externalId: "person-1",
    displayName: "Alice Engineer",
    email: "alice@example.com",
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

describe("E2E: CRUD through IssueStoreRepository", () => {
  let store: InMemoryIssueStore;
  let repo: PiperRepository;

  beforeEach(async () => {
    store = new InMemoryIssueStore();
    await store.initialize({});

    repo = new IssueStoreRepository(store, {
      workspace: {
        id: "ws-1",
        slug: "core-ops",
        name: "Core Operations",
        description: "Main workspace",
        tenantName: "Noovoleum",
      },
    });
  });

  // -------------------------------------------------------------------------
  // Workspace
  // -------------------------------------------------------------------------

  describe("workspace operations", () => {
    it("lists workspaces with correct summary", async () => {
      store.seedTask(createTestTask({ id: "t1", status: "backlog" }));
      store.seedTask(createTestTask({ id: "t2", status: "done" }));
      store.seedTask(createTestTask({
        id: "t3",
        status: "in-progress",
        dueDate: "2020-01-01", // overdue
      }));
      store.seedProject(createTestProject({ id: "p1" }));

      const workspaces = await repo.listWorkspaces();
      expect(workspaces).toHaveLength(1);

      const ws = workspaces[0];
      expect(ws.id).toBe("ws-1");
      expect(ws.slug).toBe("core-ops");
      expect(ws.summary.taskCount).toBe(3);
      expect(ws.summary.projectCount).toBe(1);
      expect(ws.summary.openTaskCount).toBe(2);
      expect(ws.summary.overdueTaskCount).toBe(1);
    });

    it("returns active workspace", async () => {
      const ws = await repo.getActiveWorkspace();
      expect(ws.id).toBe("ws-1");
    });
  });

  // -------------------------------------------------------------------------
  // Task CRUD
  // -------------------------------------------------------------------------

  describe("task CRUD", () => {
    it("creates a task through the repository", async () => {
      const task = await repo.createTask({
        workspaceId: "ws-1",
        title: "E2E Task",
        status: "planned",
        priority: "high",
        labels: ["e2e"],
      });

      expect(task.title).toBe("E2E Task");
      expect(task.status).toBe("planned");
      expect(task.priority).toBe("high");
      expect(task.labels).toEqual(["e2e"]);

      // Verify it's persisted through the store
      const fetched = await store.getTask(task.id);
      expect(fetched).toEqual(task);
    });

    it("updates a task through the repository", async () => {
      const task = await repo.createTask({
        workspaceId: "ws-1",
        title: "Original",
      });

      const updated = await repo.updateTask({
        workspaceId: "ws-1",
        taskId: task.id,
        patch: { title: "Updated", status: "in-progress" },
      });

      expect(updated.title).toBe("Updated");
      expect(updated.status).toBe("in-progress");

      // Verify through store
      const stored = await store.getTask(task.id);
      expect(stored?.title).toBe("Updated");
    });

    it("lists tasks with filters", async () => {
      store.seedTask(createTestTask({ id: "t1", status: "backlog", projectId: "p1" }));
      store.seedTask(createTestTask({ id: "t2", status: "in-progress", projectId: "p1" }));
      store.seedTask(createTestTask({ id: "t3", status: "done", projectId: "p2" }));

      const all = await repo.listWorkspaceTasks({
        workspaceId: "ws-1",
        includeCompleted: true,
      });
      expect(all).toHaveLength(3);

      const open = await repo.listWorkspaceTasks({ workspaceId: "ws-1" });
      expect(open).toHaveLength(2);

      const filtered = await repo.listWorkspaceTasks({
        workspaceId: "ws-1",
        projectId: "p1",
        includeCompleted: true,
      });
      expect(filtered).toHaveLength(2);
    });

    it("lists tasks by status", async () => {
      store.seedTask(createTestTask({ id: "t1", status: "backlog" }));
      store.seedTask(createTestTask({ id: "t2", status: "in-progress" }));
      store.seedTask(createTestTask({ id: "t3", status: "done" }));

      const result = await repo.listWorkspaceTasks({
        workspaceId: "ws-1",
        statuses: ["backlog", "in-progress"],
      });
      expect(result).toHaveLength(2);
      expect(result.every((t) => t.status !== "done")).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Project operations
  // -------------------------------------------------------------------------

  describe("project operations", () => {
    it("lists projects", async () => {
      store.seedProject(createTestProject({ id: "p1", title: "Alpha", status: "active" }));
      store.seedProject(createTestProject({ id: "p2", title: "Beta", status: "complete" }));

      const open = await repo.listWorkspaceProjects({ workspaceId: "ws-1" });
      expect(open).toHaveLength(1);
      expect(open[0].title).toBe("Alpha");

      const all = await repo.listWorkspaceProjects({
        workspaceId: "ws-1",
        includeCompleted: true,
      });
      expect(all).toHaveLength(2);
    });

    it("filters projects by parent", async () => {
      store.seedProject(createTestProject({ id: "p1", title: "Parent" }));
      store.seedProject(createTestProject({ id: "p2", title: "Child", parentProjectId: "p1" }));

      const children = await repo.listWorkspaceProjects({
        workspaceId: "ws-1",
        parentProjectId: "p1",
        includeCompleted: true,
      });
      expect(children).toHaveLength(1);
      expect(children[0].title).toBe("Child");
    });
  });

  // -------------------------------------------------------------------------
  // People
  // -------------------------------------------------------------------------

  describe("people", () => {
    it("lists people from the store", async () => {
      store.seedPerson(createTestPerson({ id: "p1", displayName: "Alice" }));
      store.seedPerson(createTestPerson({ id: "p2", displayName: "Bob" }));

      const people = await repo.listWorkspacePeople("ws-1");
      expect(people).toHaveLength(2);
      const names = people.map((p) => p.displayName).sort();
      expect(names).toEqual(["Alice", "Bob"]);
    });
  });

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------

  describe("comments", () => {
    it("creates a comment through the repository", async () => {
      const task = await repo.createTask({
        workspaceId: "ws-1",
        title: "Commented Task",
      });

      const comment = await repo.createComment({
        workspaceId: "ws-1",
        entityType: "task",
        entityId: task.id,
        body: "Test comment",
        bodyFormat: "plain-text",
      });

      expect(comment.body).toBe("Test comment");
      expect(comment.entityId).toBe(task.id);

      // Verify through store
      const comments = await store.listComments(task.id);
      expect(comments).toHaveLength(1);
      expect(comments[0].body).toBe("Test comment");
    });

    it("returns empty list for workspace-wide comments", async () => {
      const comments = await repo.listWorkspaceComments("ws-1");
      expect(comments).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Cross-cutting: dispose clears everything
  // -------------------------------------------------------------------------

  describe("dispose", () => {
    it("clears all data after dispose", async () => {
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
