import { commentFixtures } from "@/features/comments/fixtures/comments";
import type { CommentRef } from "@/features/comments/types";
import { projectFixtures } from "@/features/projects/fixtures/projects";
import type { WorkspaceProject } from "@/features/projects/types";
import { taskFixtures } from "@/features/tasks/fixtures/tasks";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { PiperWorkspace } from "@/lib/domain/workspace";
import type { PiperRepository, WorkspaceProjectQuery, WorkspaceTaskQuery } from "@/lib/repository/piper-repository";

const mockWorkspace: PiperWorkspace = {
  id: "workspace-core-ops",
  slug: "core-ops",
  name: "Core Ops",
  description:
    "Shared workspace for Piper foundation work, combining shell delivery, workspace bootstrap planning, and Graph adapter discovery.",
  tenantName: "Piper Design Lab",
  mode: "mock",
  sourceRefs: [
    {
      siteId: "site-core-ops",
      webId: "web-core-ops",
      listId: "list-tasks-core-ops",
      label: "Core Ops Tasks",
      entityType: "task",
    },
    {
      siteId: "site-core-ops",
      webId: "web-core-ops",
      listId: "list-projects-core-ops",
      label: "Core Ops Projects",
      entityType: "project",
    },
    {
      siteId: "site-core-ops",
      webId: "web-core-ops",
      listId: "list-comments-core-ops",
      label: "Core Ops Comments",
      entityType: "comment",
    },
  ],
  presets: [
    {
      id: "preset-workspace-list",
      name: "Workspace",
      kind: "list",
      description: "Default task list with recent work and active planning focus.",
      default: true,
    },
    {
      id: "preset-kanban",
      name: "Kanban",
      kind: "kanban",
      description: "Status-organized planning board for daily execution.",
      default: false,
    },
    {
      id: "preset-gantt",
      name: "Timeline",
      kind: "gantt",
      description: "Project and task timeline view for delivery planning.",
      default: false,
    },
  ],
  summary: {
    taskCount: taskFixtures.length,
    projectCount: projectFixtures.length,
    openTaskCount: taskFixtures.filter((task) => task.status !== "done").length,
    overdueTaskCount: taskFixtures.filter((task) => task.dueDate !== undefined && task.dueDate < "2026-03-27" && task.status !== "done").length,
  },
  createdAt: "2026-03-18T08:00:00.000Z",
  updatedAt: "2026-03-27T17:40:00.000Z",
};

const peopleById = new Map(
  [
    ...projectFixtures.flatMap((project) => [project.owner, ...project.collaborators]),
    ...taskFixtures.flatMap((task) => [task.assignee, task.reporter, task.createdBy, task.modifiedBy, ...task.watchers]),
    ...commentFixtures.flatMap((comment) => [comment.author, ...comment.mentions]),
  ]
    .filter((person): person is NonNullable<(typeof taskFixtures)[number]["assignee"]> => person !== undefined)
    .map((person) => [person.id, person]),
);

function hydrateTask(task: WorkspaceTask): WorkspaceTask {
  return {
    ...task,
    comments: commentFixtures.filter((comment) => comment.entityType === "task" && comment.entityId === task.id),
  };
}

function cloneComment(comment: CommentRef): CommentRef {
  return {
    ...comment,
    author: { ...comment.author },
    mentions: comment.mentions.map((person) => ({ ...person })),
  };
}

function cloneProject(project: WorkspaceProject): WorkspaceProject {
  return {
    ...project,
    owner: { ...project.owner },
    collaborators: project.collaborators.map((person) => ({ ...person })),
    labels: [...project.labels],
    path: [...project.path],
    milestoneIds: [...project.milestoneIds],
    milestones: project.milestones.map((milestone) => ({ ...milestone })),
    taskIds: [...project.taskIds],
    health: { ...project.health },
  };
}

function cloneTask(task: WorkspaceTask): WorkspaceTask {
  return {
    ...task,
    assignee: task.assignee ? { ...task.assignee } : undefined,
    reporter: task.reporter ? { ...task.reporter } : undefined,
    watchers: task.watchers.map((person) => ({ ...person })),
    path: [...task.path],
    labels: [...task.labels],
    checklist: task.checklist.map((item) => ({ ...item })),
    attachments: task.attachments.map((attachment) => ({ ...attachment })),
    commentIds: [...task.commentIds],
    comments: task.comments?.map(cloneComment),
    createdBy: { ...task.createdBy },
    modifiedBy: { ...task.modifiedBy },
  };
}

export class MockPiperRepository implements PiperRepository {
  async listWorkspaces() {
    return [{ ...mockWorkspace, sourceRefs: mockWorkspace.sourceRefs.map((sourceRef) => ({ ...sourceRef })), presets: mockWorkspace.presets.map((preset) => ({ ...preset })), summary: { ...mockWorkspace.summary } }];
  }

  async getActiveWorkspace() {
    const [workspace] = await this.listWorkspaces();
    return workspace;
  }

  async listWorkspacePeople(workspaceId: string) {
    if (workspaceId !== mockWorkspace.id) {
      return [];
    }

    return Array.from(peopleById.values()).map((person) => ({ ...person }));
  }

  async listWorkspaceProjects(query: WorkspaceProjectQuery) {
    const projects = projectFixtures
      .filter((project) => project.workspaceId === query.workspaceId)
      .filter((project) => (query.parentProjectId === undefined ? true : project.parentProjectId === query.parentProjectId))
      .filter((project) => (query.includeCompleted ? true : project.status !== "complete"))
      .map(cloneProject);

    return projects;
  }

  async listWorkspaceTasks(query: WorkspaceTaskQuery) {
    const tasks = taskFixtures
      .filter((task) => task.workspaceId === query.workspaceId)
      .filter((task) => (query.projectId === undefined ? true : task.projectId === query.projectId))
      .filter((task) => (query.assigneeId === undefined ? true : task.assignee?.id === query.assigneeId))
      .filter((task) => (query.statuses === undefined ? true : query.statuses.includes(task.status)))
      .filter((task) => (query.includeCompleted ? true : task.status !== "done"))
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(hydrateTask)
      .map(cloneTask);

    return tasks;
  }

  async listWorkspaceComments(workspaceId: string) {
    if (workspaceId !== mockWorkspace.id) {
      return [];
    }

    return commentFixtures.map(cloneComment);
  }
}

export const mockPiperRepository = new MockPiperRepository();
