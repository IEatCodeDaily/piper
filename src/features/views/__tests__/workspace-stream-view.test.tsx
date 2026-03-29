import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceStreamView } from "../workspace-stream-view";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { PersonRef } from "@/features/people/types";

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

function expectSummaryCount(label: string, count: string) {
  const labelNode = screen.getByText(label);
  expect(labelNode.previousElementSibling?.textContent).toBe(count);
}

describe("WorkspaceStreamView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows summary stats for open, in-progress, done, blocked, and overdue tasks", () => {
    const projects = [createProject()];
    const tasks = [
      createTask({ id: "task-backlog", title: "Backlog task", status: "backlog", dueDate: "2026-03-30T00:00:00.000Z", updatedAt: "2026-03-28T11:55:00.000Z" }),
      createTask({ id: "task-planned", title: "Planned task", status: "planned", dueDate: "2026-03-26T00:00:00.000Z", updatedAt: "2026-03-28T11:50:00.000Z" }),
      createTask({ id: "task-progress", title: "In progress task", status: "in-progress", updatedAt: "2026-03-28T11:45:00.000Z" }),
      createTask({ id: "task-review", title: "In review task", status: "in-review", updatedAt: "2026-03-28T11:40:00.000Z" }),
      createTask({ id: "task-done", title: "Done task", status: "done", dueDate: "2026-03-20T00:00:00.000Z", updatedAt: "2026-03-28T11:35:00.000Z" }),
      createTask({ id: "task-blocked", title: "Blocked task", status: "blocked", dueDate: "2026-03-25T00:00:00.000Z", updatedAt: "2026-03-28T11:30:00.000Z" }),
    ];

    render(
      <WorkspaceStreamView
        tasks={tasks}
        projects={projects}
        selectedTaskId={null}
        onSelectTask={vi.fn()}
      />,
    );

    expectSummaryCount("Open", "2");
    expectSummaryCount("In Progress", "2");
    expectSummaryCount("Done", "1");
    expectSummaryCount("Blocked", "1");
    expectSummaryCount("Overdue", "2");
  });

  it("highlights the selected task and notifies when another task is selected", () => {
    const onSelectTask = vi.fn();
    const assignee = createPerson({ displayName: "Jamie Rivera" });
    const projects = [createProject()];
    const tasks = [
      createTask({ id: "task-a", title: "Review launch checklist", assignee, updatedAt: "2026-03-28T11:50:00.000Z" }),
      createTask({ id: "task-b", title: "Ship analytics summary", status: "in-progress", assignee, updatedAt: "2026-03-28T11:55:00.000Z" }),
    ];

    render(
      <WorkspaceStreamView
        tasks={tasks}
        projects={projects}
        selectedTaskId="task-b"
        onSelectTask={onSelectTask}
      />,
    );

    const selectedTask = screen.getByRole("button", { name: /ship analytics summary/i });
    const unselectedTask = screen.getByRole("button", { name: /review launch checklist/i });

    expect(selectedTask.className).toContain("border-[var(--primary)]");
    expect(unselectedTask.className).toContain("border-transparent");

    fireEvent.click(unselectedTask);
    expect(onSelectTask).toHaveBeenCalledWith("task-a");
  });

  it("shows an empty state when there are no tasks", () => {
    render(
      <WorkspaceStreamView
        tasks={[]}
        projects={[]}
        selectedTaskId={null}
        onSelectTask={vi.fn()}
      />,
    );

    expect(screen.getByText("No tasks to display.")).toBeTruthy();
  });
});
