import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ViewSwitcher } from "../view-switcher";
import type { TaskFilters } from "@/features/filters/types";
import type { PersonRef } from "@/features/people/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";

const viewMocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  list: vi.fn(),
  kanban: vi.fn(),
  timeline: vi.fn(),
  myTasks: vi.fn(),
}));

vi.mock("@/features/views/workspace-stream-view", () => ({
  WorkspaceStreamView: (props: { tasks: WorkspaceTask[]; selectedTaskId: string | null }) => {
    viewMocks.workspace(props);
    return <div data-testid="workspace-view">{props.tasks.map((task) => task.title).join(",")}</div>;
  },
}));

vi.mock("@/features/views/list-view", () => ({
  ListView: (props: { tasks: WorkspaceTask[]; selectedTaskId: string | null }) => {
    viewMocks.list(props);
    return <div data-testid="list-view">{props.tasks.map((task) => task.title).join(",")}</div>;
  },
}));

vi.mock("@/features/views/kanban-view", () => ({
  KanbanView: (props: { tasks: WorkspaceTask[] }) => {
    viewMocks.kanban(props);
    return <div data-testid="kanban-view">kanban</div>;
  },
}));

vi.mock("@/features/views/timeline-view", () => ({
  TimelineView: (props: { tasks: WorkspaceTask[] }) => {
    viewMocks.timeline(props);
    return <div data-testid="timeline-view">timeline</div>;
  },
}));

vi.mock("@/features/views/my-tasks-view", () => ({
  MyTasksView: (props: { tasks: WorkspaceTask[]; currentUserName: string }) => {
    viewMocks.myTasks(props);
    return <div data-testid="my-tasks-view">{props.currentUserName}:{props.tasks.map((task) => task.title).join(",")}</div>;
  },
}));

function createPerson(overrides: Partial<PersonRef> = {}): PersonRef {
  return {
    id: "person-1",
    externalId: "person-1",
    displayName: "Alex Johnson",
    email: "alex@example.com",
    ...overrides,
  };
}

function createTask(overrides: Partial<WorkspaceTask> = {}): WorkspaceTask {
  const owner = createPerson();

  return {
    id: "task-1",
    externalId: "TASK-1",
    workspaceId: "workspace-1",
    title: "Default task",
    status: "backlog",
    priority: "medium",
    description: "Task description",
    assignee: owner,
    reporter: owner,
    watchers: [],
    projectId: "project-1",
    projectCode: "OPS",
    path: [],
    labels: [],
    sortOrder: 0,
    checklist: [],
    attachments: [],
    commentIds: [],
    createdAt: "2026-03-20T08:00:00.000Z",
    updatedAt: "2026-03-28T11:00:00.000Z",
    createdBy: owner,
    modifiedBy: owner,
    ...overrides,
  };
}

function createProject(overrides: Partial<WorkspaceProject> = {}): WorkspaceProject {
  const owner = createPerson();

  return {
    id: "project-1",
    externalId: "project-1",
    workspaceId: "workspace-1",
    projectCode: "OPS",
    title: "Operations",
    description: "Operations project",
    status: "active",
    health: {
      status: "on-track",
      summary: "Healthy",
    },
    owner,
    collaborators: [],
    priority: "medium",
    progressPercent: 50,
    labels: [],
    path: [],
    milestoneIds: [],
    milestones: [],
    taskIds: [],
    taskCount: 0,
    openTaskCount: 0,
    createdAt: "2026-03-01T08:00:00.000Z",
    updatedAt: "2026-03-28T08:00:00.000Z",
    ...overrides,
  };
}

const emptyFilters: TaskFilters = {
  status: [],
  assigneeId: [],
  projectId: [],
  searchQuery: "",
};

describe("ViewSwitcher", () => {
  beforeEach(() => {
    Object.values(viewMocks).forEach((mock) => mock.mockClear());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the workspace stream view with tasks filtered before routing", async () => {
    const projects = [createProject(), createProject({ id: "project-2", projectCode: "ENG", title: "Engineering" })];
    const tasks = [
      createTask({
        id: "task-match",
        title: "Fix workspace switcher",
        status: "blocked",
        assignee: createPerson({ id: "person-2", externalId: "person-2", displayName: "Jamie Rivera", email: "jamie@example.com" }),
        projectId: "project-2",
        description: "Investigate the list routing issue",
      }),
      createTask({ id: "task-status-miss", title: "Planned follow-up", status: "planned", assignee: createPerson({ id: "person-2", externalId: "person-2", displayName: "Jamie Rivera", email: "jamie@example.com" }), projectId: "project-2" }),
      createTask({ id: "task-assignee-miss", title: "Fix workspace search", status: "blocked", assignee: createPerson({ id: "person-3", externalId: "person-3", displayName: "Morgan Lee", email: "morgan@example.com" }), projectId: "project-2" }),
      createTask({ id: "task-project-miss", title: "Fix workspace selection", status: "blocked", assignee: createPerson({ id: "person-2", externalId: "person-2", displayName: "Jamie Rivera", email: "jamie@example.com" }), projectId: "project-1" }),
      createTask({ id: "task-search-miss", title: "Review blockers", status: "blocked", assignee: createPerson({ id: "person-2", externalId: "person-2", displayName: "Jamie Rivera", email: "jamie@example.com" }), projectId: "project-2", description: "Non-matching description" }),
    ];

    render(
      <ViewSwitcher
        view="workspace"
        tasks={tasks}
        projects={projects}
        selectedTaskId="task-match"
        onSelectTask={vi.fn()}
        currentUserId="person-2"
        currentUserName="Jamie Rivera"
        filters={{
          status: ["blocked"],
          assigneeId: ["person-2"],
          projectId: ["project-2"],
          searchQuery: "switcher",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("workspace-view").textContent).toBe("Fix workspace switcher");
    });
    expect(screen.queryByTestId("list-view")).toBeNull();

    const props = viewMocks.workspace.mock.calls[0]?.[0];
    expect(props.tasks).toHaveLength(1);
    expect(props.tasks[0]?.id).toBe("task-match");
    expect(props.selectedTaskId).toBe("task-match");
  });

  it("routes list view requests to the list view component", async () => {
    const tasks = [createTask({ id: "task-a", title: "Audit release notes" })];

    render(
      <ViewSwitcher
        view="list"
        tasks={tasks}
        projects={[createProject()]}
        selectedTaskId={null}
        onSelectTask={vi.fn()}
        currentUserId="person-1"
        currentUserName="Alex Johnson"
        filters={emptyFilters}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("list-view").textContent).toBe("Audit release notes");
    });
    expect(screen.queryByTestId("workspace-view")).toBeNull();
    expect(viewMocks.list).toHaveBeenCalledTimes(1);
    expect(viewMocks.workspace).not.toHaveBeenCalled();
  });

  it("limits my-tasks view to the current user after applying shared filters", async () => {
    const tasks = [
      createTask({ id: "task-current", title: "Prepare weekly QA report", status: "in-progress", assignee: createPerson({ id: "person-9", externalId: "person-9", displayName: "Taylor Brooks", email: "taylor@example.com" }) }),
      createTask({ id: "task-other", title: "Pair on bug triage", status: "in-progress", assignee: createPerson({ id: "person-3", externalId: "person-3", displayName: "Morgan Lee", email: "morgan@example.com" }) }),
      createTask({ id: "task-filtered-out", title: "Closed item", status: "done", assignee: createPerson({ id: "person-9", externalId: "person-9", displayName: "Taylor Brooks", email: "taylor@example.com" }) }),
    ];

    render(
      <ViewSwitcher
        view="my-tasks"
        tasks={tasks}
        projects={[createProject()]}
        selectedTaskId={null}
        onSelectTask={vi.fn()}
        currentUserId="person-9"
        currentUserName="Taylor Brooks"
        filters={{ ...emptyFilters, status: ["in-progress"] }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("my-tasks-view").textContent).toBe("Taylor Brooks:Prepare weekly QA report");
    });

    const props = viewMocks.myTasks.mock.calls[0]?.[0];
    expect(props.tasks).toHaveLength(1);
    expect(props.tasks[0]?.id).toBe("task-current");
    expect(props.currentUserName).toBe("Taylor Brooks");
  });
});
