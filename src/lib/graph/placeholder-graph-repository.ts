import type { WorkspaceConfig } from "@/features/workspaces/types"
import {
  applyProjectTaskAggregates,
  attachCommentsToTasks,
  buildGraphBackedWorkspace,
  collectPeopleFromGraphEntities,
  mapGraphListCommentToCommentRef,
  mapGraphListItemToWorkspaceProject,
  mapGraphListItemToWorkspaceTask,
} from "@/lib/graph/piper-graph-adapter"
import { mockGraphWorkspaceBindings } from "@/lib/graph/mock-graph-payloads"
import { mockGraphClient, type GraphClient } from "@/lib/graph/graph-client"
import type { CommentRef } from "@/features/comments/types"
import type { WorkspaceProject } from "@/features/projects/types"
import type { WorkspaceTask } from "@/features/tasks/types"
import type { PiperWorkspace } from "@/lib/domain/workspace"
import type {
  CreateCommentInput,
  PiperRepository,
  TaskUpdateInput,
  WorkspaceProjectQuery,
  WorkspaceTaskQuery,
} from "@/lib/repository/piper-repository"

export class PlaceholderGraphRepository implements PiperRepository {
  private readonly workspaceConfigs: WorkspaceConfig[]
  private readonly graphClient: GraphClient
  private readonly taskOverrides = new Map<string, Partial<WorkspaceTask>>()
  private readonly localComments = new Map<string, CommentRef[]>()

  constructor(options: {
    workspaceConfigs?: WorkspaceConfig[]
    graphClient?: GraphClient
  } = {}) {
    this.workspaceConfigs = options.workspaceConfigs ?? mockGraphWorkspaceBindings.map((binding) => binding.config)
    this.graphClient = options.graphClient ?? mockGraphClient
  }

  private getWorkspaceConfig(workspaceId: string) {
    const config = this.workspaceConfigs.find((candidate) => candidate.workspace.id === workspaceId)

    if (!config) {
      throw new Error(`No Graph workspace config is registered for '${workspaceId}'.`)
    }

    return config
  }

  private getDefaultWorkspaceConfig() {
    const config = this.workspaceConfigs[0]

    if (!config) {
      throw new Error("No Graph workspaces have been configured.")
    }

    return config
  }

  private async fetchWorkspaceProjects(workspaceId: string) {
    const config = this.getWorkspaceConfig(workspaceId)
    const collection = await this.graphClient.listItems({
      siteId: config.lists.projects.site.id,
      listId: config.lists.projects.list.id,
      selectFields: Object.values(config.lists.projects.fields).map((field) => field.sourceField),
    })

    return collection.value.map((item) => mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item }))
  }

  private async fetchWorkspaceTasks(workspaceId: string) {
    const config = this.getWorkspaceConfig(workspaceId)
    const collection = await this.graphClient.listItems({
      siteId: config.lists.tasks.site.id,
      listId: config.lists.tasks.list.id,
      selectFields: Object.values(config.lists.tasks.fields).map((field) => field.sourceField),
    })

    return collection.value.map((item) => mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item }))
  }

  private async fetchWorkspaceComments(workspaceId: string) {
    const config = this.getWorkspaceConfig(workspaceId)

    const [projectItems, taskItems] = await Promise.all([
      this.graphClient.listItems({
        siteId: config.lists.projects.site.id,
        listId: config.lists.projects.list.id,
      }),
      this.graphClient.listItems({
        siteId: config.lists.tasks.site.id,
        listId: config.lists.tasks.list.id,
      }),
    ])

    const projectComments = await Promise.all(
      projectItems.value.map(async (item) => {
        const comments = await this.graphClient.listComments({
          siteId: config.lists.projects.site.id,
          listId: config.lists.projects.list.id,
          itemId: item.id,
        })

        return comments.value.map((graphComment) =>
          mapGraphListCommentToCommentRef({
            workspaceConfig: config,
            listId: config.lists.projects.list.id,
            itemId: item.id,
            entityType: "project",
            graphComment,
          }),
        )
      }),
    )

    const taskComments = await Promise.all(
      taskItems.value.map(async (item) => {
        const comments = await this.graphClient.listComments({
          siteId: config.lists.tasks.site.id,
          listId: config.lists.tasks.list.id,
          itemId: item.id,
        })

        return comments.value.map((graphComment) =>
          mapGraphListCommentToCommentRef({
            workspaceConfig: config,
            listId: config.lists.tasks.list.id,
            itemId: item.id,
            entityType: "task",
            graphComment,
          }),
        )
      }),
    )

    return [...projectComments.flat(), ...taskComments.flat()]
  }

  async listWorkspaces(): Promise<PiperWorkspace[]> {
    return Promise.all(
      this.workspaceConfigs.map(async (config) => {
        const [projects, tasks] = await Promise.all([
          this.fetchWorkspaceProjects(config.workspace.id),
          this.fetchWorkspaceTasks(config.workspace.id),
        ])

        return buildGraphBackedWorkspace({
          workspaceConfig: config,
          projects,
          tasks,
        })
      }),
    )
  }

  async getActiveWorkspace(): Promise<PiperWorkspace> {
    const config = this.getDefaultWorkspaceConfig()
    const [workspace] = await this.listWorkspaces()

    if (workspace.id !== config.workspace.id) {
      throw new Error("The active Graph workspace could not be resolved.")
    }

    return workspace
  }

  async listWorkspacePeople(workspaceId: string) {
    const [projects, hydratedTasks, comments] = await Promise.all([
      this.listWorkspaceProjects({ workspaceId, includeCompleted: true }),
      this.listWorkspaceTasks({ workspaceId, includeCompleted: true }),
      this.listWorkspaceComments(workspaceId),
    ])

    return collectPeopleFromGraphEntities({
      projects,
      tasks: hydratedTasks,
      comments,
    })
  }

  async listWorkspaceProjects(query: WorkspaceProjectQuery): Promise<WorkspaceProject[]> {
    const [projects, tasks] = await Promise.all([
      this.fetchWorkspaceProjects(query.workspaceId),
      this.fetchWorkspaceTasks(query.workspaceId),
    ])

    return applyProjectTaskAggregates(projects, tasks)
      .filter((project) => (query.parentProjectId === undefined ? true : project.parentProjectId === query.parentProjectId))
      .filter((project) => (query.includeCompleted ? true : project.status !== "complete"))
  }

  async listWorkspaceTasks(query: WorkspaceTaskQuery): Promise<WorkspaceTask[]> {
    const [tasks, comments] = await Promise.all([
      this.fetchWorkspaceTasks(query.workspaceId),
      this.fetchWorkspaceComments(query.workspaceId),
    ])

    return attachCommentsToTasks(
      tasks.map((task) => ({
        ...task,
        ...(this.taskOverrides.get(task.id) ?? {}),
      })),
      comments,
    )
      .filter((task) => (query.projectId === undefined ? true : task.projectId === query.projectId))
      .filter((task) => (query.assigneeId === undefined ? true : task.assignee?.id === query.assigneeId))
      .filter((task) => (query.statuses === undefined ? true : query.statuses.includes(task.status)))
      .filter((task) => (query.includeCompleted ? true : task.status !== "done"))
      .sort((left, right) => left.sortOrder - right.sortOrder)
  }

  async listWorkspaceComments(workspaceId: string): Promise<CommentRef[]> {
    const remoteComments = await this.fetchWorkspaceComments(workspaceId)
    const localComments = Array.from(this.localComments.values()).flat()
    return [...remoteComments, ...localComments.filter((comment) => comment.id.startsWith(`${workspaceId}:`))]
  }

  async updateTask(input: TaskUpdateInput): Promise<WorkspaceTask> {
    const tasks = await this.listWorkspaceTasks({
      workspaceId: input.workspaceId,
      includeCompleted: true,
    })
    const existingTask = tasks.find((task) => task.id === input.taskId)
    if (!existingTask) {
      throw new Error(`Task '${input.taskId}' was not found in workspace '${input.workspaceId}'.`)
    }

    const updatedTask: WorkspaceTask = {
      ...existingTask,
      ...input.patch,
      updatedAt: new Date().toISOString(),
    }

    this.taskOverrides.set(input.taskId, {
      ...this.taskOverrides.get(input.taskId),
      ...input.patch,
      updatedAt: updatedTask.updatedAt,
    })

    return updatedTask
  }

  async createComment(input: CreateCommentInput): Promise<CommentRef> {
    const comment: CommentRef = {
      id: `${input.workspaceId}:comment:${Date.now()}`,
      externalId: `local-${Date.now()}`,
      threadId: input.entityId,
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body,
      bodyFormat: input.bodyFormat ?? "plain-text",
      author: {
        id: "graph-user",
        externalId: "graph-user",
        displayName: "Signed-in Microsoft user",
        email: "graph.user@local.invalid",
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      edited: false,
      mentions: [],
    }

    const threadComments = this.localComments.get(input.entityId) ?? []
    this.localComments.set(input.entityId, [...threadComments, comment])
    return comment
  }
}

export const placeholderGraphRepository = new PlaceholderGraphRepository()
