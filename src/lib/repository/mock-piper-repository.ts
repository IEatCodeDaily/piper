import { commentFixtures } from "@/features/comments/fixtures/comments";
import type { CommentRef } from "@/features/comments/types";
import { projectFixtures } from "@/features/projects/fixtures/projects";
import type { WorkspaceProject } from "@/features/projects/types";
import { taskFixtures } from "@/features/tasks/fixtures/tasks";
import type { WorkspaceTask } from "@/features/tasks/types";
import { coreOpsWorkspaceFixture } from "@/features/workspaces/fixtures";
import type { PiperWorkspace } from "@/lib/domain/workspace";
import type {
  CreateCommentInput,
  CreateTaskInput,
  PiperRepository,
  TaskUpdateInput,
  WorkspaceProjectQuery,
  WorkspaceTaskQuery,
} from "@/lib/repository/piper-repository";

const mutableComments: CommentRef[] = structuredClone(commentFixtures);
const mutableTasks: WorkspaceTask[] = structuredClone(taskFixtures);
const mutableProjects: WorkspaceProject[] = structuredClone(projectFixtures);

const mockWorkspace: PiperWorkspace = {
  id: coreOpsWorkspaceFixture.workspace.id,
  slug: coreOpsWorkspaceFixture.workspace.id,
  name: coreOpsWorkspaceFixture.workspace.label,
  description: coreOpsWorkspaceFixture.workspace.description ?? "Shared workspace for Piper foundation work.",
  tenantName: coreOpsWorkspaceFixture.workspace.tenant.label,
  mode: "mock",
  sourceRefs: [
    {
      siteId: coreOpsWorkspaceFixture.lists.tasks.site.id,
      listId: coreOpsWorkspaceFixture.lists.tasks.list.id,
      label: coreOpsWorkspaceFixture.lists.tasks.list.label,
      entityType: "task",
    },
    {
      siteId: coreOpsWorkspaceFixture.lists.projects.site.id,
      listId: coreOpsWorkspaceFixture.lists.projects.list.id,
      label: coreOpsWorkspaceFixture.lists.projects.list.label,
      entityType: "project",
    },
  ],
  presets: coreOpsWorkspaceFixture.views.map((view) => ({
    id: view.id,
    name: view.label,
    kind: view.kind,
    description: view.description,
    default: view.isDefault,
  })),
  summary: {
    taskCount: mutableTasks.length,
    projectCount: mutableProjects.length,
    openTaskCount: mutableTasks.filter((task) => task.status !== "done").length,
    overdueTaskCount: mutableTasks.filter((task) => task.dueDate !== undefined && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== "done").length,
  },
  createdAt: mutableProjects[0]?.createdAt ?? mutableTasks[0]?.createdAt ?? new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const peopleById = new Map(
  [
    ...mutableProjects.flatMap((project) => [project.owner, ...project.collaborators]),
    ...mutableTasks.flatMap((task) => [task.assignee, task.reporter, task.createdBy, task.modifiedBy, ...task.watchers]),
    ...mutableComments.flatMap((comment) => [comment.author, ...comment.mentions]),
  ]
    .filter((person): person is NonNullable<(typeof mutableTasks)[number]["assignee"]> => person !== undefined)
    .map((person) => [person.id, person]),
);

function cloneComment(comment: CommentRef): CommentRef {
  return {
    ...comment,
    author: { ...comment.author },
    mentions: comment.mentions.map((person) => ({ ...person })),
  };
}

function hydrateTask(task: WorkspaceTask): WorkspaceTask {
  return {
    ...task,
    comments: mutableComments.filter((comment) => comment.entityType === "task" && comment.entityId === task.id).map(cloneComment),
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

function recomputeWorkspaceSummary() {
  mockWorkspace.summary = {
    taskCount: mutableTasks.length,
    projectCount: mutableProjects.length,
    openTaskCount: mutableTasks.filter((task) => task.status !== "done").length,
    overdueTaskCount: mutableTasks.filter((task) => task.dueDate !== undefined && task.dueDate < "2026-03-27" && task.status !== "done").length,
  };
  mockWorkspace.updatedAt = new Date().toISOString();
}

export class MockPiperRepository implements PiperRepository {
  async listWorkspaces() {
    recomputeWorkspaceSummary();
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
    return mutableProjects
      .filter((project) => project.workspaceId === query.workspaceId)
      .filter((project) => (query.parentProjectId === undefined ? true : project.parentProjectId === query.parentProjectId))
      .filter((project) => (query.includeCompleted ? true : project.status !== "complete"))
      .map(cloneProject);
  }

  async listWorkspaceTasks(query: WorkspaceTaskQuery) {
    return mutableTasks
      .filter((task) => task.workspaceId === query.workspaceId)
      .filter((task) => (query.projectId === undefined ? true : task.projectId === query.projectId))
      .filter((task) => (query.assigneeId === undefined ? true : task.assignee?.id === query.assigneeId))
      .filter((task) => (query.statuses === undefined ? true : query.statuses.includes(task.status)))
      .filter((task) => (query.includeCompleted ? true : task.status !== "done"))
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map(hydrateTask)
      .map(cloneTask);
  }

  async listWorkspaceComments(workspaceId: string) {
    if (workspaceId !== mockWorkspace.id) {
      return [];
    }
    return mutableComments.map(cloneComment);
  }

  async updateTask(input: TaskUpdateInput) {
    const task = mutableTasks.find((candidate) => candidate.id === input.taskId && candidate.workspaceId === input.workspaceId);
    if (!task) {
      throw new Error(`Task '${input.taskId}' was not found in workspace '${input.workspaceId}'.`);
    }

    Object.assign(task, input.patch, {
      updatedAt: new Date().toISOString(),
    });
    recomputeWorkspaceSummary();
    return cloneTask(hydrateTask(task));
  }

  async createTask(input: CreateTaskInput) {
    const newTaskId = `task-local-${mutableTasks.length + 1}`;
    const now = new Date().toISOString();
    const project = mutableProjects.find((p) => p.id === input.projectId);

    const newTask: WorkspaceTask = {
      id: newTaskId,
      externalId: `TASK-${300 + mutableTasks.length + 1}`,
      workspaceId: input.workspaceId,
      title: input.title,
      status: input.status ?? "backlog",
      priority: input.priority ?? "medium",
      description: "",
      assignee: input.assigneeId ? peopleById.get(input.assigneeId) : undefined,
      reporter: undefined,
      watchers: [],
      projectId: input.projectId,
      projectCode: project?.projectCode,
      parentTaskId: undefined,
      path: [input.title],
      labels: input.labels ?? [],
      startDate: input.startDate,
      dueDate: input.dueDate,
      completedAt: undefined,
      estimatePoints: undefined,
      remainingPoints: undefined,
      sortOrder: mutableTasks.length * 10 + 10,
      checklist: [],
      attachments: [],
      commentIds: [],
      comments: [],
      createdAt: now,
      updatedAt: now,
      createdBy: {
        id: "person-zephyr",
        externalId: "u-101",
        displayName: "Zephyr",
        email: "zephyr@piper.local",
        jobTitle: "Engineering Lead",
        department: "Platform",
        avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Zephyr",
        presence: "busy",
      },
      modifiedBy: {
        id: "person-zephyr",
        externalId: "u-101",
        displayName: "Zephyr",
        email: "zephyr@piper.local",
        jobTitle: "Engineering Lead",
        department: "Platform",
        avatarUrl: "https://api.dicebear.com/9.x/initials/svg?seed=Zephyr",
        presence: "busy",
      },
    };

    mutableTasks.push(newTask);
    if (project) {
      project.taskIds = [...project.taskIds, newTaskId];
      project.taskCount += 1;
      project.openTaskCount += 1;
    }
    recomputeWorkspaceSummary();
    return cloneTask(hydrateTask(newTask));
  }

  async createComment(input: CreateCommentInput) {
    const comment: CommentRef = {
      id: `comment-local-${mutableComments.length + 1}`,
      externalId: `comment-local-${mutableComments.length + 1}`,
      threadId: input.entityId,
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body,
      bodyFormat: input.bodyFormat ?? "plain-text",
      author: {
        id: "person-zephyr",
        externalId: "u-101",
        displayName: "Zephyr",
        email: "zephyr@piper.local",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      edited: false,
      mentions: [],
    };
    mutableComments.push(comment);
    const task = mutableTasks.find((candidate) => candidate.id === input.entityId);
    if (task) {
      task.commentIds = [...task.commentIds, comment.id];
      task.updatedAt = new Date().toISOString();
    }
    recomputeWorkspaceSummary();
    return cloneComment(comment);
  }
}

export const mockPiperRepository = new MockPiperRepository();
