import { describe, it, expect } from "vitest";
import type { WorkspaceConfig } from "@/features/workspaces/types";
import type {
  GraphListItem,
  GraphListItemComment,
  GraphFieldPersonValue,
} from "@/lib/graph/types";
import type { CommentRef } from "@/features/comments/types";
import {
  mapGraphListCommentToCommentRef,
  mapGraphListItemToWorkspaceProject,
  mapGraphListItemToWorkspaceTask,
  attachCommentsToTasks,
  applyProjectTaskAggregates,
  collectPeopleFromGraphEntities,
  buildGraphBackedWorkspace,
} from "@/lib/graph/piper-graph-adapter";

// ---------------------------------------------------------------------------
// Minimal workspace config for tests
// ---------------------------------------------------------------------------

function makeTestConfig(): WorkspaceConfig {
  return {
    version: 1,
    workspace: {
      id: "test-workspace",
      label: "Test Workspace",
      description: "A test workspace.",
      tenant: {
        id: "tenant-001",
        label: "Test Tenant",
        domain: "test.example.com",
      },
    },
    lists: {
      tasks: {
        site: { id: "site-tasks", label: "Tasks Site" },
        list: { id: "list-tasks", label: "Tasks" },
        fields: {
          title: { sourceField: "Title", dataType: "string", required: true, editable: true },
          status: { sourceField: "TaskStatus", dataType: "choice", required: true, editable: true },
          priority: { sourceField: "TaskPriority", dataType: "choice", required: true, editable: true },
          description: { sourceField: "Body", dataType: "text", required: false, editable: true },
          assignee: { sourceField: "AssignedTo", dataType: "person", required: false, editable: true },
          projectRef: { sourceField: "ProjectLookup", dataType: "lookup", required: false, editable: true },
          parentTaskRef: { sourceField: "ParentTask", dataType: "lookup", required: false, editable: true },
          startDate: { sourceField: "StartDate", dataType: "date", required: false, editable: true },
          dueDate: { sourceField: "DueDate", dataType: "date", required: false, editable: true },
          labels: { sourceField: "Tags", dataType: "labels", required: false, editable: true },
        },
        renderers: {},
        relations: {},
      },
      projects: {
        site: { id: "site-projects", label: "Projects Site" },
        list: { id: "list-projects", label: "Projects" },
        fields: {
          title: { sourceField: "Title", dataType: "string", required: true, editable: true },
          status: { sourceField: "ProjectStatus", dataType: "choice", required: true, editable: true },
          owner: { sourceField: "ProjectOwner", dataType: "person", required: false, editable: true },
          description: { sourceField: "Description", dataType: "text", required: false, editable: true },
          projectCode: { sourceField: "ProjectCode", dataType: "string", required: true, editable: true },
          startDate: { sourceField: "StartDate", dataType: "date", required: false, editable: true },
          dueDate: { sourceField: "TargetDate", dataType: "date", required: false, editable: true },
          parentProjectRef: { sourceField: "ParentProject", dataType: "lookup", required: false, editable: true },
        },
        renderers: {},
        relations: {},
      },
    },
    views: [
      { id: "list-1", label: "All Tasks", kind: "list", isDefault: true },
    ],
  } as unknown as WorkspaceConfig;
}

type GraphListItemFields = GraphListItem["fields"];
function makeGraphListItem(overrides: Partial<GraphListItemFields> & Record<string, unknown> = {}): GraphListItem {
  return {
    id: String(Math.floor(Math.random() * 10000)),
    createdDateTime: "2026-01-15T10:00:00Z",
    lastModifiedDateTime: "2026-02-20T14:30:00Z",
    createdBy: {
      user: { id: "user-001", displayName: "Ada Lovelace", email: "ada@example.com" },
    },
    lastModifiedBy: {
      user: { id: "user-002", displayName: "Grace Hopper", email: "grace@example.com" },
    },
    ...overrides,
    fields: {
      Title: "Test Item",
      ...overrides.fields,
    },
  };
}

function makePerson(): GraphFieldPersonValue {
  return {
    LookupId: 42,
    LookupValue: "Jane Smith",
    Email: "jane@example.com",
    DisplayName: "Jane Smith",
    JobTitle: "Engineer",
    Department: "Platform",
  };
}

// ---------------------------------------------------------------------------
// mapGraphListItemToWorkspaceTask
// ---------------------------------------------------------------------------

describe("mapGraphListItemToWorkspaceTask", () => {
  const config = makeTestConfig();

    const item = makeGraphListItem({ fields: { TaskStatus: "Backlog" } });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });
    expect(task.title).toBe("Untitled task");

  });

  it("defaults title to 'Untitled task' when missing", () => {
    const item = makeGraphListItem({ fields: {} });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });
    expect(task.title).toBe("Untitled task");
  });

  it("defaults title to 'Untitled project' when missing", () => {
    const item = makeGraphListItem({ fields: {} });
    const project = mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item });
    expect(project.title).toBe("Untitled project");
  });

  it("defaults title to 'Untitled task' when missing", () => {
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.title).toBe("Fix login bug");
    expect(task.status).toBe("in-progress");
    expect(task.priority).toBe("high");
    expect(task.workspaceId).toBe("test-workspace");
    expect(task.id).toContain("tasks");
    expect(task.id).toContain("list-tasks");
  });

  it("defaults title to 'Untitled task' when missing", () => {
    const item = makeGraphListItem({ fields: { TaskStatus: "Backlog" } });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });
    expect(task.title).toBe("Untitled task");
  });

  it("normalizes various status values", () => {
    const cases: [string, string][] = [
      ["Not Started", "planned"],
      ["planned", "planned"],
      ["In Progress", "in-progress"],
      ["blocked", "blocked"],
      ["In Review", "in-review"],
      ["Done", "done"],
      ["completed", "done"],
      ["backlog", "backlog"],
      ["", "backlog"],
      ["Unknown Status", "backlog"],
    ];

    for (const [input, expected] of cases) {
      const item = makeGraphListItem({ fields: { TaskStatus: input } });
      const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });
      expect(task.status).toBe(expected);
    }
  });

  it("normalizes priority values", () => {
    const cases: [string, string][] = [
      ["urgent", "urgent"],
      ["High", "high"],
      ["medium", "medium"],
      ["Low", "low"],
      ["", "low"],
      ["unknown", "low"],
    ];

    for (const [input, expected] of cases) {
      const item = makeGraphListItem({ fields: { TaskPriority: input } });
      const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });
      expect(task.priority).toBe(expected);
    }
  });

  it("maps assignee from person field", () => {
    const person = makePerson();
    const item = makeGraphListItem({
      fields: { AssignedTo: person },
    });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.assignee).toBeDefined();
    expect(task.assignee!.displayName).toBe("Jane Smith");
    expect(task.assignee!.email).toBe("jane@example.com");
  });

  it("maps project reference from lookup field", () => {
    const item = makeGraphListItem({
      fields: {
        ProjectLookup: { LookupId: 5, LookupValue: "ALPHA" },
      },
    });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.projectId).toContain("projects");
    expect(task.projectId).toContain("5");
    expect(task.projectCode).toBe("ALPHA");
  });

  it("maps parent task reference from lookup field", () => {
    const item = makeGraphListItem({
      fields: {
        ParentTask: { LookupId: 99, LookupValue: "Parent task" },
      },
    });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.parentTaskId).toContain("tasks");
    expect(task.parentTaskId).toContain("99");
  });

  it("maps labels from comma-separated string field", () => {
    const item = makeGraphListItem({
      fields: { Tags: "frontend; bug; priority" },
    });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.labels).toEqual(["frontend", "bug", "priority"]);
  });

  it("maps labels from semicolon-separated string", () => {
    const item = makeGraphListItem({
      fields: { Tags: "backend;infra" },
    });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.labels).toEqual(["backend", "infra"]);
  });

  it("maps date fields", () => {
    const item = makeGraphListItem({
      fields: {
        StartDate: "2026-01-01",
        DueDate: "2026-03-15",
      },
    });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.startDate).toBe("2026-01-01");
    expect(task.dueDate).toBe("2026-03-15");
  });

  it("handles task with all undefined optional fields", () => {
    const item = makeGraphListItem({ fields: {} });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.assignee).toBeUndefined();
    expect(task.projectId).toBeUndefined();
    expect(task.parentTaskId).toBeUndefined();
    expect(task.labels).toEqual([]);
    expect(task.startDate).toBeUndefined();
    expect(task.dueDate).toBeUndefined();
    expect(task.description).toBe("");
  });

  it("uses item.id as externalId fallback when TaskKey is missing", () => {
    const item = makeGraphListItem({ fields: {} });
    item.id = "42";
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.externalId).toBe("42");
  });

  it("preserves createdBy and modifiedBy from Graph metadata", () => {
    const item = makeGraphListItem({ fields: {} });
    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item });

    expect(task.createdBy.displayName).toBe("Ada Lovelace");
    expect(task.modifiedBy.displayName).toBe("Grace Hopper");
  });
});

// ---------------------------------------------------------------------------
// mapGraphListItemToWorkspaceProject
// ---------------------------------------------------------------------------

describe("mapGraphListItemToWorkspaceProject", () => {
  const config = makeTestConfig();

  it("maps a basic project with title and status", () => {
    const item = makeGraphListItem({
      fields: {
        Title: "Platform Redesign",
        ProjectStatus: "Active",
        ProjectCode: "PLATFORM-01",
      },
    });

    const project = mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item });

    expect(project.title).toBe("Platform Redesign");
    expect(project.status).toBe("active");
    expect(project.projectCode).toBe("PLATFORM-01");
    expect(project.workspaceId).toBe("test-workspace");
    expect(project.id).toContain("projects");
  });

  it("defaults title to 'Untitled project' when missing", () => {
    const item = makeGraphListItem({ fields: {} });
    const project = mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item });
    expect(project.title).toBe("Untitled project");
  });

  it("normalizes project status values", () => {
    const cases: [string, string][] = [
      ["active", "active"],
      ["blocked", "blocked"],
      ["Done", "complete"],
      ["complete", "complete"],
      ["On Hold", "on-hold"],
      ["on-hold", "on-hold"],
      ["", "planned"],
      ["unknown", "planned"],
    ];

    for (const [input, expected] of cases) {
      const item = makeGraphListItem({ fields: { ProjectStatus: input } });
      const project = mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item });
      expect(project.status).toBe(expected);
    }
  });

  it("maps owner from person field, falls back to createdBy", () => {
    const person = makePerson();
    const item = makeGraphListItem({
      fields: { ProjectOwner: person },
    });
    const project = mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item });

    expect(project.owner.displayName).toBe("Jane Smith");
    expect(project.owner.email).toBe("jane@example.com");
  });

  it("falls back to createdBy when no owner field", () => {
    const item = makeGraphListItem({ fields: {} });
    const project = mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item });

    expect(project.owner.displayName).toBe("Ada Lovelace");
  });

  it("maps parent project reference from lookup field", () => {
    const item = makeGraphListItem({
      fields: {
        ParentProject: { LookupId: 3, LookupValue: "Parent Program" },
      },
    });
    const project = mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item });

    expect(project.parentProjectId).toContain("projects");
    expect(project.parentProjectId).toContain("3");
  });

  it("maps date fields for projects", () => {
    const item = makeGraphListItem({
      fields: {
        StartDate: "2026-01-01",
        TargetDate: "2026-06-30",
      },
    });
    const project = mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item });

    expect(project.startDate).toBe("2026-01-01");
    expect(project.targetDate).toBe("2026-06-30");
  });
});

// ---------------------------------------------------------------------------
// mapGraphListCommentToCommentRef
// ---------------------------------------------------------------------------

describe("mapGraphListCommentToCommentRef", () => {
  const config = makeTestConfig();

  function makeGraphComment(overrides: Partial<GraphListItemComment> = {}): GraphListItemComment {
    return {
      id: "comment-001",
      content: "This looks good to me.",
      contentType: "text",
      createdDateTime: "2026-03-01T09:00:00Z",
      lastModifiedDateTime: "2026-03-01T09:00:00Z",
      createdBy: {
        user: { id: "user-003", displayName: "Alan Turing", email: "alan@example.com" },
      },
      ...overrides,
    };
  }

  it("maps a basic comment to CommentRef", () => {
    const comment = mapGraphListCommentToCommentRef({
      workspaceConfig: config,
      listId: "list-tasks",
      itemId: "42",
      entityType: "task",
      graphComment: makeGraphComment(),
    });

    expect(comment.id).toContain("comment");
    expect(comment.id).toContain("list-tasks");
    expect(comment.id).toContain("42");
    expect(comment.body).toBe("This looks good to me.");
    expect(comment.entityType).toBe("task");
    expect(comment.author.displayName).toBe("Alan Turing");
    expect(comment.createdAt).toBe("2026-03-01T09:00:00Z");
    expect(comment.edited).toBe(false);
  });

  it("detects edited comments", () => {
    const comment = mapGraphListCommentToCommentRef({
      workspaceConfig: config,
      listId: "list-tasks",
      itemId: "1",
      entityType: "task",
      graphComment: makeGraphComment({
        lastModifiedDateTime: "2026-03-02T12:00:00Z",
      }),
    });

    expect(comment.edited).toBe(true);
  });

  it("maps HTML content type", () => {
    const comment = mapGraphListCommentToCommentRef({
      workspaceConfig: config,
      listId: "list-tasks",
      itemId: "1",
      entityType: "task",
      graphComment: makeGraphComment({ contentType: "html" }),
    });

    expect(comment.bodyFormat).toBe("html");
  });

  it("defaults to plain-text for non-HTML content", () => {
    const comment = mapGraphListCommentToCommentRef({
      workspaceConfig: config,
      listId: "list-tasks",
      itemId: "1",
      entityType: "task",
      graphComment: makeGraphComment({ contentType: "text" }),
    });

    expect(comment.bodyFormat).toBe("plain-text");
  });

  it("maps mentions from graph comment", () => {
    const comment = mapGraphListCommentToCommentRef({
      workspaceConfig: config,
      listId: "list-tasks",
      itemId: "1",
      entityType: "task",
      graphComment: makeGraphComment({
        mentions: [
          {
            id: "mention-1",
            mentionText: "@Jane",
            mentioned: {
              user: { id: "user-010", displayName: "Jane Smith", email: "jane@example.com" },
            },
          },
        ],
      }),
    });

    expect(comment.mentions).toHaveLength(1);
    expect(comment.mentions[0].displayName).toBe("Jane Smith");
  });

  it("maps project entity type correctly", () => {
    const comment = mapGraphListCommentToCommentRef({
      workspaceConfig: config,
      listId: "list-projects",
      itemId: "5",
      entityType: "project",
      graphComment: makeGraphComment(),
    });

    expect(comment.entityType).toBe("project");
    expect(comment.entityId).toContain("projects");
  });
});

// ---------------------------------------------------------------------------
// attachCommentsToTasks
// ---------------------------------------------------------------------------

describe("attachCommentsToTasks", () => {
  it("attaches matching comments to tasks", () => {
    const tasks = [
      { id: "task-1", commentIds: [], comments: [] } as any,
      { id: "task-2", commentIds: [], comments: [] } as any,
    ];

    const comments = [
      { id: "c1", entityId: "task-1", body: "First" } as any,
      { id: "c2", entityId: "task-1", body: "Second" } as any,
      { id: "c3", entityId: "task-2", body: "Third" } as any,
    ];

    const result = attachCommentsToTasks(tasks, comments);

    expect(result[0].comments).toHaveLength(2);
    expect(result[0].commentIds).toEqual(["c1", "c2"]);
    expect(result[1].comments).toHaveLength(1);
    expect(result[1].commentIds).toEqual(["c3"]);
  });

  it("handles tasks with no comments", () => {
    const tasks = [{ id: "task-1", commentIds: [], comments: [] } as any];
    const result = attachCommentsToTasks(tasks, []);
    expect(result[0].comments).toEqual([]);
    expect(result[0].commentIds).toEqual([]);
  });

  it("handles empty tasks array", () => {
    const result = attachCommentsToTasks([], [{ id: "c1", entityId: "task-1" } as any]);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// applyProjectTaskAggregates
// ---------------------------------------------------------------------------

describe("applyProjectTaskAggregates", () => {
  it("counts tasks per project", () => {
    const projects = [
      { id: "proj-1", taskIds: [], taskCount: 0, openTaskCount: 0 } as any,
      { id: "proj-2", taskIds: [], taskCount: 0, openTaskCount: 0 } as any,
    ];

    const tasks = [
      { id: "t1", projectId: "proj-1", status: "in-progress" } as any,
      { id: "t2", projectId: "proj-1", status: "done" } as any,
      { id: "t3", projectId: "proj-2", status: "planned" } as any,
    ];

    const result = applyProjectTaskAggregates(projects, tasks);

    expect(result[0].taskCount).toBe(2);
    expect(result[0].openTaskCount).toBe(1); // only in-progress
    expect(result[0].taskIds).toEqual(["t1", "t2"]);
    expect(result[1].taskCount).toBe(1);
    expect(result[1].openTaskCount).toBe(1);
  });

  it("handles project with no tasks", () => {
    const projects = [{ id: "proj-1", taskIds: [], taskCount: 0, openTaskCount: 0 } as any];
    const result = applyProjectTaskAggregates(projects, []);

    expect(result[0].taskCount).toBe(0);
    expect(result[0].openTaskCount).toBe(0);
    expect(result[0].taskIds).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// collectPeopleFromGraphEntities
// ---------------------------------------------------------------------------

describe("collectPeopleFromGraphEntities", () => {
  it("collects unique people from projects, tasks, and comments", () => {
    const projects = [
      {
        owner: { id: "p1", displayName: "Owner", email: "owner@test.com" },
        collaborators: [
          { id: "p2", displayName: "Collab", email: "collab@test.com" },
        ],
      },
    ] as any;

    const tasks = [
      {
        assignee: { id: "p3", displayName: "Assignee", email: "assignee@test.com" },
        reporter: { id: "p1", displayName: "Owner", email: "owner@test.com" }, // duplicate
        createdBy: { id: "p4", displayName: "Creator", email: "creator@test.com" },
        modifiedBy: { id: "p4", displayName: "Creator", email: "creator@test.com" }, // duplicate
        watchers: [],
      },
    ] as any;

    const comments = [
      {
        author: { id: "p5", displayName: "Commenter", email: "commenter@test.com" },
        mentions: [
          { id: "p3", displayName: "Assignee", email: "assignee@test.com" }, // duplicate
        ],
      },
    ] as any;

    const people = collectPeopleFromGraphEntities({ projects, tasks, comments });

    expect(people).toHaveLength(5);
    const ids = people.map((p) => p.id).sort();
    expect(ids).toEqual(["p1", "p2", "p3", "p4", "p5"]);
  });

  it("handles empty entities", () => {
    const people = collectPeopleFromGraphEntities({
      projects: [],
      tasks: [],
      comments: [],
    });
    expect(people).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildGraphBackedWorkspace
// ---------------------------------------------------------------------------

describe("buildGraphBackedWorkspace", () => {
  const config = makeTestConfig();

  it("builds workspace from config and entities", () => {
    const workspace = buildGraphBackedWorkspace({
      workspaceConfig: config,
      projects: [],
      tasks: [],
    });

    expect(workspace.id).toBe("test-workspace");
    expect(workspace.name).toBe("Test Workspace");
    expect(workspace.mode).toBe("graph");
    expect(workspace.tenantName).toBe("Test Tenant");
    expect(workspace.summary.taskCount).toBe(0);
    expect(workspace.summary.projectCount).toBe(0);
    expect(workspace.presets).toHaveLength(1);
    expect(workspace.presets[0].name).toBe("All Tasks");
  });

  it("computes summary with task counts", () => {
    const workspace = buildGraphBackedWorkspace({
      workspaceConfig: config,
      projects: [{ id: "p1" } as any],
      tasks: [
        { id: "t1", status: "in-progress" } as any,
        { id: "t2", status: "done" } as any,
        { id: "t3", status: "backlog" } as any,
      ],
    });

    expect(workspace.summary.taskCount).toBe(3);
    expect(workspace.summary.projectCount).toBe(1);
    expect(workspace.summary.openTaskCount).toBe(2); // in-progress + backlog
  });

  it("sets source refs for tasks and projects lists", () => {
    const workspace = buildGraphBackedWorkspace({
      workspaceConfig: config,
      projects: [],
      tasks: [],
    });

    expect(workspace.sourceRefs).toHaveLength(2);
    expect(workspace.sourceRefs[0].entityType).toBe("task");
    expect(workspace.sourceRefs[1].entityType).toBe("project");
  });
});
