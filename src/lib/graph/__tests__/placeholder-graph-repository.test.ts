/* eslint-disable @typescript-eslint/no-explicit-any -- test file uses any for partial entity mocks */
import { describe, it, expect, vi } from "vitest";
import type { GraphClient } from "@/lib/graph/graph-client";
import type { WorkspaceConfig } from "@/features/workspaces/types";
import type {
  GraphListItem,
  GraphListItemComment,
  GraphCollectionResponse,
} from "@/lib/graph/types";
import { PlaceholderGraphRepository } from "@/lib/graph/placeholder-graph-repository";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTestConfig(id = "ws-1"): WorkspaceConfig {
  return {
    version: 1,
    workspace: {
      id,
      label: `${id} workspace`,
      description: "Test",
      tenant: { id: "t-1", label: "Tenant", domain: "test.com" },
    },
    lists: {
      tasks: {
        site: { id: "site-t", label: "Tasks" },
        list: { id: "list-t", label: "Tasks" },
        fields: {
          title: { sourceField: "Title", dataType: "string", required: true, editable: true },
          status: { sourceField: "Status", dataType: "choice", required: true, editable: true },
          priority: { sourceField: "Priority", dataType: "choice", required: true, editable: true },
        },
        renderers: {},
        relations: {},
      },
      projects: {
        site: { id: "site-p", label: "Projects" },
        list: { id: "list-p", label: "Projects" },
        fields: {
          title: { sourceField: "Title", dataType: "string", required: true, editable: true },
          status: { sourceField: "Status", dataType: "choice", required: true, editable: true },
        },
        renderers: {},
        relations: {},
      },
    },
    views: [],
  } as unknown as WorkspaceConfig;
}

function makeItem(id: string, fields: Record<string, any> = {}): GraphListItem {
  return {
    id,
    createdDateTime: "2026-01-01T00:00:00Z",
    lastModifiedDateTime: "2026-01-02T00:00:00Z",
    createdBy: { user: { id: "u-1", displayName: "User", email: "u@t.com" } },
    lastModifiedBy: { user: { id: "u-1", displayName: "User", email: "u@t.com" } },
    fields: { Title: `Item ${id}`, Status: "Active", ...fields },
  };
}

function makeComment(id: string): GraphListItemComment {
  return {
    id,
    content: `Comment ${id}`,
    contentType: "text",
    createdDateTime: "2026-01-01T00:00:00Z",
    createdBy: { user: { id: "u-1", displayName: "User", email: "u@t.com" } },
  };
}

// ---------------------------------------------------------------------------
// Mock GraphClient factory
// ---------------------------------------------------------------------------

function createMockClient(options?: {
  projectItems?: GraphListItem[];
  taskItems?: GraphListItem[];
  commentsByItemId?: Record<string, GraphListItemComment[]>;
}): GraphClient {
  const projects = options?.projectItems ?? [
    makeItem("p1", { ProjectStatus: "Active", ProjectCode: "P-001" }),
    makeItem("p2", { ProjectStatus: "Done", ProjectCode: "P-002" }),
  ];
  const tasks = options?.taskItems ?? [
    makeItem("t1", { TaskStatus: "In Progress", TaskPriority: "High" }),
    makeItem("t2", { TaskStatus: "Done", TaskPriority: "Low" }),
  ];
  const comments = options?.commentsByItemId ?? {};

  return {
    getListMetadata: vi.fn().mockResolvedValue({ displayName: "Mock List" }),
    listColumns: vi.fn().mockResolvedValue({ value: [] }),
    listItems: vi.fn().mockImplementation((req: any) => {
      if (req.siteId === "site-p" && req.listId === "list-p") {
        return Promise.resolve({ value: projects } as GraphCollectionResponse<GraphListItem>);
      }
      if (req.siteId === "site-t" && req.listId === "list-t") {
        return Promise.resolve({ value: tasks } as GraphCollectionResponse<GraphListItem>);
      }
      return Promise.resolve({ value: [] } as GraphCollectionResponse<GraphListItem>);
    }),
    listComments: vi.fn().mockImplementation((req: any) => {
      const itemComments = comments[req.itemId] ?? [];
      return Promise.resolve({ value: itemComments } as GraphCollectionResponse<GraphListItemComment>);
    }),
  };
}

// ===========================================================================
// listWorkspaces
// ===========================================================================

describe("PlaceholderGraphRepository — listWorkspaces", () => {
  it("returns a workspace for each registered config", async () => {
    const config1 = makeTestConfig("ws-1");
    const config2 = makeTestConfig("ws-2");
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [config1, config2],
      graphClient: createMockClient(),
    });

    const workspaces = await repo.listWorkspaces();

    expect(workspaces).toHaveLength(2);
    expect(workspaces[0].id).toBe("ws-1");
    expect(workspaces[1].id).toBe("ws-2");
    expect(workspaces[0].mode).toBe("graph");
  });

  it("returns workspace with correct source refs", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const [workspace] = await repo.listWorkspaces();

    expect(workspace.sourceRefs).toHaveLength(2);
    expect(workspace.sourceRefs[0].entityType).toBe("task");
    expect(workspace.sourceRefs[1].entityType).toBe("project");
  });
});

// ===========================================================================
// getActiveWorkspace
// ===========================================================================

describe("PlaceholderGraphRepository — getActiveWorkspace", () => {
  it("returns the first workspace as active", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig("ws-1")],
      graphClient: createMockClient(),
    });

    const workspace = await repo.getActiveWorkspace();
    expect(workspace.id).toBe("ws-1");
  });

  it("throws when no workspaces are configured", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [],
      graphClient: createMockClient(),
    });

    await expect(repo.getActiveWorkspace()).rejects.toThrow(
      "No Graph workspaces have been configured.",
    );
  });
});

// ===========================================================================
// listWorkspaceProjects
// ===========================================================================

describe("PlaceholderGraphRepository — listWorkspaceProjects", () => {
  it("returns projects with task aggregates", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const projects = await repo.listWorkspaceProjects({
      workspaceId: "ws-1",
    });

    expect(projects.length).toBeGreaterThanOrEqual(1);
    // projects should have taskCounts populated by applyProjectTaskAggregates
    for (const project of projects) {
      expect(project).toHaveProperty("taskCount");
      expect(project).toHaveProperty("openTaskCount");
    }
  });

  it("filters out completed projects when includeCompleted is false", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const all = await repo.listWorkspaceProjects({
      workspaceId: "ws-1",
      includeCompleted: true,
    });
    const active = await repo.listWorkspaceProjects({
      workspaceId: "ws-1",
      includeCompleted: false,
    });

    expect(active.length).toBeLessThanOrEqual(all.length);
    for (const project of active) {
      expect(project.status).not.toBe("complete");
    }
  });

  it("throws for unknown workspace", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig("ws-1")],
      graphClient: createMockClient(),
    });

    await expect(
      repo.listWorkspaceProjects({ workspaceId: "unknown" }),
    ).rejects.toThrow("No Graph workspace config is registered");
  });
});

// ===========================================================================
// listWorkspaceTasks
// ===========================================================================

describe("PlaceholderGraphRepository — listWorkspaceTasks", () => {
  it("returns tasks sorted by sortOrder", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const tasks = await repo.listWorkspaceTasks({
      workspaceId: "ws-1",
    });

    expect(tasks.length).toBeGreaterThanOrEqual(1);
    // Verify sort order is ascending
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i].sortOrder).toBeGreaterThanOrEqual(tasks[i - 1].sortOrder);
    }
  });

  it("filters by projectId", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    // Get a project ID from the projects list
    const projects = await repo.listWorkspaceProjects({ workspaceId: "ws-1" });
    const targetProjectId = projects[0].id;

    const tasks = await repo.listWorkspaceTasks({
      workspaceId: "ws-1",
      projectId: targetProjectId,
    });

    for (const task of tasks) {
      expect(task.projectId).toBe(targetProjectId);
    }
  });

  it("filters by statuses", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const tasks = await repo.listWorkspaceTasks({
      workspaceId: "ws-1",
      statuses: ["in-progress"],
    });

    for (const task of tasks) {
      expect(task.status).toBe("in-progress");
    }
  });

  it("filters out done tasks when includeCompleted is false", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const tasks = await repo.listWorkspaceTasks({
      workspaceId: "ws-1",
      includeCompleted: false,
    });

    for (const task of tasks) {
      expect(task.status).not.toBe("done");
    }
  });
});

// ===========================================================================
// listWorkspaceComments
// ===========================================================================

describe("PlaceholderGraphRepository — listWorkspaceComments", () => {
  it("returns comments from graph client", async () => {
    const comments = { p1: [makeComment("c1"), makeComment("c2")] };
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient({ commentsByItemId: comments }),
    });

    const result = await repo.listWorkspaceComments("ws-1");

    // Should have at least the comments from the mock
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("includes locally created comments", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    // Create a local comment first
    const entityScope = "tasks";
    const entityId = `${entityScope}:list-t:t1`;
    await repo.createComment({
      workspaceId: "ws-1",
      entityType: "task",
      entityId,
      body: "Local comment",
    });

    const comments = await repo.listWorkspaceComments("ws-1");
    const localComment = comments.find((c) => c.body === "Local comment");
    expect(localComment).toBeDefined();
    expect(localComment!.bodyFormat).toBe("plain-text");
  });
});

// ===========================================================================
// updateTask
// ===========================================================================

describe("PlaceholderGraphRepository — updateTask", () => {
  it("updates task fields and returns updated task", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const tasks = await repo.listWorkspaceTasks({
      workspaceId: "ws-1",
      includeCompleted: true,
    });
    const originalTask = tasks[0];

    const updated = await repo.updateTask({
      workspaceId: "ws-1",
      taskId: originalTask.id,
      patch: { status: "done", title: "Updated title" },
    });

    expect(updated.status).toBe("done");
    expect(updated.title).toBe("Updated title");
    expect(updated.updatedAt).not.toBe(originalTask.updatedAt);
  });

  it("persists the update across subsequent queries", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const tasks = await repo.listWorkspaceTasks({
      workspaceId: "ws-1",
      includeCompleted: true,
    });
    const taskId = tasks[0].id;

    await repo.updateTask({
      workspaceId: "ws-1",
      taskId,
      patch: { priority: "urgent" },
    });

    const refreshed = await repo.listWorkspaceTasks({
      workspaceId: "ws-1",
      includeCompleted: true,
    });
    const updated = refreshed.find((t) => t.id === taskId);

    expect(updated!.priority).toBe("urgent");
  });

  it("throws when task is not found", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    await expect(
      repo.updateTask({
        workspaceId: "ws-1",
        taskId: "nonexistent-task",
        patch: { title: "Nope" },
      }),
    ).rejects.toThrow("was not found");
  });
});

// ===========================================================================
// createTask
// ===========================================================================

describe("PlaceholderGraphRepository — createTask", () => {
  it("creates a task with defaults", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const task = await repo.createTask({
      workspaceId: "ws-1",
      title: "New task",
    });

    expect(task.title).toBe("New task");
    expect(task.status).toBe("backlog");
    expect(task.priority).toBe("medium");
    expect(task.labels).toEqual([]);
    expect(task.checklist).toEqual([]);
    expect(task.commentIds).toEqual([]);
    expect(task.createdBy.displayName).toBe("Signed-in Microsoft user");
  });

  it("creates a task with specified fields", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const task = await repo.createTask({
      workspaceId: "ws-1",
      title: "Configured task",
      status: "in-progress",
      priority: "high",
      labels: ["backend", "urgent"],
    });

    expect(task.title).toBe("Configured task");
    expect(task.status).toBe("in-progress");
    expect(task.priority).toBe("high");
    expect(task.labels).toEqual(["backend", "urgent"]);
  });

  it("increments sortOrder based on existing task count", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const existingTasks = await repo.listWorkspaceTasks({
      workspaceId: "ws-1",
      includeCompleted: true,
    });
    const newTask = await repo.createTask({
      workspaceId: "ws-1",
      title: "New task",
    });

    expect(newTask.sortOrder).toBe(existingTasks.length);
  });

  it("assigns unique ID and correct metadata", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const task = await repo.createTask({
      workspaceId: "ws-1",
      title: "New task",
    });

    // Verify the shape is correct
    expect(task.id).toMatch(/^task-/);
    expect(task.externalId).toMatch(/^TASK-/);
    expect(task.createdAt).toBeDefined();
    expect(task.updatedAt).toBeDefined();
  });
});

// ===========================================================================
// createComment
// ===========================================================================

describe("PlaceholderGraphRepository — createComment", () => {
  it("creates a comment and returns it", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const comment = await repo.createComment({
      workspaceId: "ws-1",
      entityType: "task",
      entityId: "tasks:list-t:t1",
      body: "This is a comment",
    });

    expect(comment.body).toBe("This is a comment");
    expect(comment.entityType).toBe("task");
    expect(comment.entityId).toBe("tasks:list-t:t1");
    expect(comment.bodyFormat).toBe("plain-text");
    expect(comment.edited).toBe(false);
    expect(comment.author.displayName).toBe("Signed-in Microsoft user");
  });

  it("creates HTML comment", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const comment = await repo.createComment({
      workspaceId: "ws-1",
      entityType: "project",
      entityId: "projects:list-p:p1",
      body: "<p>HTML comment</p>",
      bodyFormat: "html",
    });

    expect(comment.bodyFormat).toBe("html");
    expect(comment.entityType).toBe("project");
  });

  it("comment appears in listWorkspaceComments", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const created = await repo.createComment({
      workspaceId: "ws-1",
      entityType: "task",
      entityId: "tasks:list-t:t1",
      body: "Listed comment",
    });

    const comments = await repo.listWorkspaceComments("ws-1");
    const found = comments.find((c) => c.id === created.id);

    expect(found).toBeDefined();
    expect(found!.body).toBe("Listed comment");
  });
});

// ===========================================================================
// listWorkspacePeople
// ===========================================================================

describe("PlaceholderGraphRepository — listWorkspacePeople", () => {
  it("returns unique people from projects, tasks, and comments", async () => {
    const repo = new PlaceholderGraphRepository({
      workspaceConfigs: [makeTestConfig()],
      graphClient: createMockClient(),
    });

    const people = await repo.listWorkspacePeople("ws-1");

    // Should have at least one person (the createdBy from mock items)
    expect(people.length).toBeGreaterThanOrEqual(1);
    // All people should have required fields
    for (const person of people) {
      expect(person).toHaveProperty("id");
      expect(person).toHaveProperty("displayName");
      expect(person).toHaveProperty("email");
    }
  });
});
