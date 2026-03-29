import { describe, expect, it, beforeEach } from "vitest";
import { InMemoryIssueStore } from "../in-memory-issue-store";
import {
  IssueStoreRepository,
  type IssueStoreRepositoryConfig,
} from "../issue-store-repository";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { PersonRef } from "@/features/people/types";

const WORKSPACE_CONFIG: IssueStoreRepositoryConfig = {
  workspace: {
    id: "ws-test",
    slug: "test-workspace",
    name: "Test Workspace",
    description: "A test workspace for unit tests",
    tenantName: "Test Tenant",
  },
};

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

describe("IssueStoreRepository", () => {
  let store: InMemoryIssueStore;
  let repo: IssueStoreRepository;

  beforeEach(async () => {
    store = new InMemoryIssueStore();
    await store.initialize({});
    repo = new IssueStoreRepository(store, WORKSPACE_CONFIG);
  });

  describe("listWorkspaces / getActiveWorkspace", () => {
    it("returns one workspace", async () => {
      const workspaces = await repo.listWorkspaces();
      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].id).toBe("ws-test");
      expect(workspaces[0].name).toBe("Test Workspace");
    });

    it("getActiveWorkspace returns the workspace", async () => {
      const ws = await repo.getActiveWorkspace();
      expect(ws.id).toBe("ws-test");
      expect(ws.tenantName).toBe("Test Tenant");
    });

    it("includes task/project summary", async () => {
      store.seedTask(createTestTask({ id: "t1", status: "backlog" }));
      store.seedTask(createTestTask({ id: "t2", status: "done" }));
      store.seedTask(createTestTask({ id: "t3", status: "in-progress", dueDate: "2020-01-01" }));

      const ws = await repo.getActiveWorkspace();
      expect(ws.summary.taskCount).toBe(3);
      expect(ws.summary.openTaskCount).toBe(2);
      expect(ws.summary.overdueTaskCount).toBe(1);
    });
  });

  describe("task operations (delegates to IssueStore)", () => {
    it("listWorkspaceTasks delegates to store.listTasks", async () => {
      store.seedTask(createTestTask({ id: "t1", status: "backlog" }));
      store.seedTask(createTestTask({ id: "t2", status: "done" }));

      const tasks = await repo.listWorkspaceTasks({
        workspaceId: "ws-test",
        includeCompleted: true,
      });
      expect(tasks).toHaveLength(2);
    });

    it("createTask delegates to store", async () => {
      const task = await repo.createTask({
        workspaceId: "ws-test",
        title: "New Task",
        status: "planned",
      });

      expect(task.title).toBe("New Task");
      expect(task.status).toBe("planned");

      const fetched = await store.getTask(task.id);
      expect(fetched?.title).toBe("New Task");
    });

    it("updateTask delegates to store", async () => {
      store.seedTask(createTestTask({ id: "t1", title: "Original" }));

      const updated = await repo.updateTask({
        workspaceId: "ws-test",
        taskId: "t1",
        patch: { title: "Updated" },
      });

      expect(updated.title).toBe("Updated");
    });
  });

  describe("comment operations", () => {
    it("createComment delegates to store", async () => {
      store.seedTask(createTestTask({ id: "t1" }));

      const comment = await repo.createComment({
        workspaceId: "ws-test",
        entityType: "task",
        entityId: "t1",
        body: "Test comment",
      });

      expect(comment.body).toBe("Test comment");
      expect(comment.entityId).toBe("t1");
    });
  });

  describe("people", () => {
    it("listWorkspacePeople delegates to store", async () => {
      store.seedPerson(createTestPerson({ id: "p1" }));
      store.seedPerson(createTestPerson({ id: "p2" }));

      const people = await repo.listWorkspacePeople("ws-test");
      expect(people).toHaveLength(2);
    });
  });
});
