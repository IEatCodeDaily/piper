/**
 * Linear-backed PiperRepository implementation.
 *
 * Implements the same PiperRepository interface used by the Graph, GitHub, and Jira adapters,
 * but backed by the Linear GraphQL API.
 * Supports multi-team: the list.id field can contain comma-separated team keys.
 */

import type { CommentRef } from "@/features/comments/types"
import type { PersonRef } from "@/features/people/types"
import type { WorkspaceProject } from "@/features/projects/types"
import type { WorkspaceTask } from "@/features/tasks/types"
import type { WorkspaceConfig } from "@/features/workspaces/types"
import type { PiperWorkspace } from "@/lib/domain/workspace"
import type {
  CreateCommentInput,
  CreateTaskInput,
  PiperRepository,
  TaskUpdateInput,
  WorkspaceProjectQuery,
  WorkspaceTaskQuery,
} from "@/lib/repository/piper-repository"

import { LinearClient } from "./linear-client"
import { fetchAllPages } from "./linear-client"
import {
  applyProjectTaskAggregates,
  buildLinearBackedWorkspace,
  collectPeopleFromLinearEntities,
  mapLinearCommentToCommentRef,
  mapLinearIssueToWorkspaceTask,
  mapLinearProjectToWorkspaceProject,
  mapLinearUser,
} from "./linear-adapter"
import type { LinearWorkflowState } from "./linear-types"

// ── Config Helpers ─────────────────────────────────────────────────────────

function extractApiBaseUrl(workspaceConfig: WorkspaceConfig): string {
  return workspaceConfig.lists.tasks.site.id
}

function extractTeamKeys(config: WorkspaceConfig): string[] {
  return config.lists.tasks.list.id.split(",").map((s) => s.trim())
}

// ── Repository ─────────────────────────────────────────────────────────────

export class LinearPiperRepository implements PiperRepository {
  private readonly workspaceConfigs: WorkspaceConfig[]
  private readonly linearClients: Map<string, LinearClient>
  private readonly localTaskOverrides = new Map<string, Partial<WorkspaceTask>>()
  private readonly localComments = new Map<string, CommentRef[]>()
  private readonly workflowStateCache = new Map<string, LinearWorkflowState[]>()

  constructor(options: {
    workspaceConfigs: WorkspaceConfig[]
    accessTokenProvider?: () => Promise<string>
    fetchImpl?: typeof globalThis.fetch
  }) {
    this.workspaceConfigs = options.workspaceConfigs
    this.linearClients = new Map()

    for (const config of this.workspaceConfigs) {
      const baseUrl = extractApiBaseUrl(config)
      const client = new LinearClient({
        baseUrl,
        accessTokenProvider: options.accessTokenProvider,
        fetch: options.fetchImpl,
      })
      this.linearClients.set(config.workspace.id, client)
    }
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private getConfig(workspaceId: string): WorkspaceConfig {
    const config = this.workspaceConfigs.find((c) => c.workspace.id === workspaceId)
    if (!config) throw new Error(`No Linear workspace config found for '${workspaceId}'.`)
    return config
  }

  private getClient(workspaceId: string): LinearClient {
    const client = this.linearClients.get(workspaceId)
    if (!client) throw new Error(`No Linear client found for workspace '${workspaceId}'.`)
    return client
  }

  /**
   * Returns the workflow states for a team, caching the results.
   */
  private async getWorkflowStatesForTeam(workspaceId: string, teamId: string): Promise<LinearWorkflowState[]> {
    const cached = this.workflowStateCache.get(teamId)
    if (cached) return cached

    const client = this.getClient(workspaceId)
    const states = await fetchAllPages((after) =>
      client.listWorkflowStates(teamId, after),
    )
    this.workflowStateCache.set(teamId, states)
    return states
  }

  /**
   * Find the workflow state ID that maps to the desired Piper status.
   */
  private async findWorkflowStateId(
    workspaceId: string,
    teamId: string,
    targetStatus: WorkspaceTask["status"],
  ): Promise<string | undefined> {
    const states = await this.getWorkflowStatesForTeam(workspaceId, teamId)

    // Map Piper status back to Linear workflow type
    const typeMap: Record<string, LinearWorkflowState["type"][]> = {
      backlog: ["backlog"],
      planned: ["unstarted", "triage"],
      "in-progress": ["started"],
      "in-review": ["started"], // Linear doesn't have a review state; use started
      blocked: ["unstarted"], // Linear doesn't have a blocked state; keep as-is
      done: ["completed", "canceled"],
    }

    const targetTypes = typeMap[targetStatus] ?? []
    const match = states.find((s) => targetTypes.includes(s.type))
    return match?.id
  }

  private async fetchAllIssuesForTeams(
    workspaceId: string,
    teamKeys: string[],
    includeCompleted = true,
  ): Promise<WorkspaceTask[]> {
    const config = this.getConfig(workspaceId)
    const client = this.getClient(workspaceId)
    const tasks: WorkspaceTask[] = []

    for (const teamKey of teamKeys) {
      const filter: Record<string, unknown> = {
        team: { key: { eq: teamKey } },
      }

      if (!includeCompleted) {
        filter.state = { type: { neq: "completed" } }
      }

      const issues = await fetchAllPages((after) =>
        client.listIssues(filter, after, 100),
      )

      for (const issue of issues) {
        tasks.push(mapLinearIssueToWorkspaceTask({ workspaceConfig: config, issue }))
      }
    }

    return tasks
  }

  private async fetchWorkspaceProjects(workspaceId: string): Promise<WorkspaceProject[]> {
    const config = this.getConfig(workspaceId)
    const client = this.getClient(workspaceId)
    const teamKeys = extractTeamKeys(config)

    const projects: WorkspaceProject[] = []
    const seen = new Set<string>()

    // Fetch projects for each team
    for (const teamKey of teamKeys) {
      const filter: Record<string, unknown> = {
        team: { key: { eq: teamKey } },
      }

      const linearProjects = await fetchAllPages((after) =>
        client.listProjects(filter, after, 50),
      )

      for (const project of linearProjects) {
        if (seen.has(project.id)) continue
        seen.add(project.id)
        projects.push(mapLinearProjectToWorkspaceProject({ workspaceConfig: config, project }))
      }
    }

    return projects
  }

  private async fetchAllCommentsForIssues(
    workspaceId: string,
    tasks: WorkspaceTask[],
  ): Promise<CommentRef[]> {
    const client = this.getClient(workspaceId)
    const config = this.getConfig(workspaceId)
    const comments: CommentRef[] = []

    // Limit to prevent excessive API calls
    const tasksToFetch = tasks.slice(0, 50)

    for (const task of tasksToFetch) {
      // Parse the Linear issue ID from externalId (e.g., "PIPER-42")
      // We need the actual Linear UUID, which is in the task.id
      // task.id format: linear:tasks:TEAM_KEY:IDENTIFIER
      // We need to fetch by identifier, not by the Piper ID
      // For comments, we'll use the filter approach
      const identifier = task.externalId

      try {
        const filter = { issue: { identifier: { eq: identifier } } }
        const linearComments = await fetchAllPages((after) =>
          client.listComments(
            // We use the identifier to filter
            // The listComments method takes issueId but we can pass identifier
            task.id.replace("linear:tasks:", "").split(":").join("-"),
            after,
          ),
        )

        for (const comment of linearComments) {
          comments.push(
            mapLinearCommentToCommentRef({
              workspaceConfig: config,
              comment,
              entityType: "task",
            }),
          )
        }
      } catch {
        // Skip comments for issues that error
      }
    }

    return comments
  }

  // ── PiperRepository Implementation ───────────────────────────────────────

  async listWorkspaces(): Promise<PiperWorkspace[]> {
    const workspaces: PiperWorkspace[] = []

    for (const config of this.workspaceConfigs) {
      try {
        const [projects, tasks] = await Promise.all([
          this.fetchWorkspaceProjects(config.workspace.id),
          this.fetchAllIssuesForTeams(config.workspace.id, extractTeamKeys(config)),
        ])
        workspaces.push(buildLinearBackedWorkspace({ workspaceConfig: config, projects, tasks }))
      } catch {
        workspaces.push({
          id: config.workspace.id,
          slug: config.workspace.id,
          name: config.workspace.label,
          description: config.workspace.description ?? "Linear workspace (error loading).",
          tenantName: config.workspace.tenant.label,
          mode: "linear" as PiperWorkspace["mode"],
          sourceRefs: [],
          presets: [],
          summary: { taskCount: 0, projectCount: 0, openTaskCount: 0, overdueTaskCount: 0 },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
    }

    return workspaces
  }

  async getActiveWorkspace(): Promise<PiperWorkspace> {
    const config = this.workspaceConfigs[0]
    if (!config) throw new Error("No Linear workspace configurations available.")

    const [projects, tasks] = await Promise.all([
      this.fetchWorkspaceProjects(config.workspace.id),
      this.fetchAllIssuesForTeams(config.workspace.id, extractTeamKeys(config)),
    ])

    return buildLinearBackedWorkspace({ workspaceConfig: config, projects, tasks })
  }

  async listWorkspacePeople(workspaceId: string): Promise<PersonRef[]> {
    const [projects, tasks] = await Promise.all([
      this.fetchWorkspaceProjects(workspaceId),
      this.fetchAllIssuesForTeams(workspaceId, extractTeamKeys(this.getConfig(workspaceId))),
    ])

    const allComments = await this.fetchAllCommentsForIssues(workspaceId, tasks)

    return collectPeopleFromLinearEntities({ projects, tasks, comments: allComments })
  }

  async listWorkspaceProjects(query: WorkspaceProjectQuery): Promise<WorkspaceProject[]> {
    let projects = await this.fetchWorkspaceProjects(query.workspaceId)

    if (query.parentProjectId) {
      projects = projects.filter((p) => p.parentProjectId === query.parentProjectId)
    }

    if (!query.includeCompleted) {
      projects = projects.filter((p) => p.status !== "complete")
    }

    return projects
  }

  async listWorkspaceTasks(query: WorkspaceTaskQuery): Promise<WorkspaceTask[]> {
    const config = this.getConfig(query.workspaceId)
    const teamKeys = extractTeamKeys(config)

    const includeCompleted = query.includeCompleted ?? false
    let tasks = await this.fetchAllIssuesForTeams(query.workspaceId, teamKeys, includeCompleted)

    // Apply local overrides
    for (const task of tasks) {
      const override = this.localTaskOverrides.get(task.id)
      if (override) {
        Object.assign(task, override)
      }
    }

    // Client-side filtering
    if (query.statuses?.length) {
      tasks = tasks.filter((task) => query.statuses!.includes(task.status))
    }

    if (query.assigneeId) {
      tasks = tasks.filter((task) => task.assignee?.id === query.assigneeId)
    }

    if (query.projectId) {
      tasks = tasks.filter((task) => task.projectId === query.projectId)
    }

    // Attach comments
    const allComments = await this.fetchAllCommentsForIssues(query.workspaceId, tasks)
    const commentsByEntity = new Map<string, CommentRef[]>()
    for (const comment of allComments) {
      const existing = commentsByEntity.get(comment.entityId) ?? []
      existing.push(comment)
      commentsByEntity.set(comment.entityId, existing)
    }

    for (const [entityId, localComments] of this.localComments) {
      const existing = commentsByEntity.get(entityId) ?? []
      commentsByEntity.set(entityId, [...existing, ...localComments])
    }

    tasks = tasks.map((task) => ({
      ...task,
      commentIds: (commentsByEntity.get(task.id) ?? []).map((c) => c.id),
      comments: commentsByEntity.get(task.id) ?? [],
    }))

    return tasks
  }

  async listWorkspaceComments(workspaceId: string): Promise<CommentRef[]> {
    const config = this.getConfig(workspaceId)
    const teamKeys = extractTeamKeys(config)
    const tasks = await this.fetchAllIssuesForTeams(workspaceId, teamKeys)
    const remoteComments = await this.fetchAllCommentsForIssues(workspaceId, tasks)
    const localComments = Array.from(this.localComments.values()).flat()
    return [...remoteComments, ...localComments]
  }

  async updateTask(input: TaskUpdateInput): Promise<WorkspaceTask> {
    const config = this.getConfig(input.workspaceId)
    const client = this.getClient(input.workspaceId)

    // Parse the Linear issue ID from the Piper task ID
    // ID format: linear:tasks:TEAM_KEY:IDENTIFIER
    const idParts = input.taskId.split(":")
    // The identifier (e.g. "PIPER-42") is the last segment
    const identifier = idParts.length >= 4 ? idParts[3]! : idParts.slice(2).join(":")

    // First, fetch the issue to get the UUID and team info
    const currentIssue = await client.getIssue(identifier)

    const updatePayload: Record<string, unknown> = {}

    if (input.patch.title !== undefined) updatePayload.title = input.patch.title
    if (input.patch.description !== undefined) updatePayload.description = input.patch.description
    if (input.patch.labels !== undefined) {
      // Labels in Linear are set by ID, but we receive names from Piper
      // For now, skip label updates (would need label name→ID lookup)
    }

    // Handle status change
    if (input.patch.status !== undefined) {
      const stateId = await this.findWorkflowStateId(
        input.workspaceId,
        currentIssue.team.id,
        input.patch.status,
      )
      if (stateId) {
        updatePayload.stateId = stateId
      }
    }

    // Handle priority
    if (input.patch.priority !== undefined) {
      const priorityMap: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      }
      updatePayload.priority = priorityMap[input.patch.priority] ?? 0
    }

    // Handle due date
    if (input.patch.dueDate !== undefined) {
      updatePayload.dueDate = input.patch.dueDate
    }

    if (Object.keys(updatePayload).length > 0) {
      await client.updateIssue(currentIssue.id, updatePayload)
    }

    // Store local override for immediate UI update
    this.localTaskOverrides.set(input.taskId, input.patch)

    // Re-fetch the issue to get updated state
    const updatedIssue = await client.getIssue(currentIssue.id)
    return mapLinearIssueToWorkspaceTask({ workspaceConfig: config, issue: updatedIssue })
  }

  async createTask(input: CreateTaskInput): Promise<WorkspaceTask> {
    const config = this.getConfig(input.workspaceId)
    const client = this.getClient(input.workspaceId)
    const teamKeys = extractTeamKeys(config)

    // Determine target team
    let targetTeamKey = teamKeys[0]!
    if (input.projectId) {
      // Try to extract team key from project ID
      const idParts = input.projectId.split(":")
      if (idParts.length >= 3) {
        // Not directly useful; use first team
      }
    }

    // We need the team UUID, not just the key. Fetch teams.
    const viewer = await client.getViewer()
    const teams = viewer.teams.nodes
    const targetTeam = teams.find((t) => t.key === targetTeamKey) ?? teams[0]
    if (!targetTeam) {
      throw new Error(`No Linear team found for key '${targetTeamKey}'.`)
    }

    const createPayload: Record<string, unknown> = {
      title: input.title,
      teamId: targetTeam.id,
    }

    if (input.description) createPayload.description = input.description
    if (input.dueDate) createPayload.dueDate = input.dueDate

    // Priority
    if (input.priority) {
      const priorityMap: Record<string, number> = {
        urgent: 1,
        high: 2,
        medium: 3,
        low: 4,
      }
      createPayload.priority = priorityMap[input.priority] ?? undefined
    }

    // Project
    if (input.projectId) {
      // Extract Linear project UUID from Piper project ID
      // ID format: linear:projects:slugId:SLUG
      const idParts = input.projectId.split(":")
      if (idParts.length >= 4) {
        // We'd need to look up the project by slugId to get the UUID
        // For now, we'll skip project assignment on create
      }
    }

    const response = await client.createIssue(createPayload as any)

    return mapLinearIssueToWorkspaceTask({ workspaceConfig: config, issue: response })
  }

  async createComment(input: CreateCommentInput): Promise<CommentRef> {
    const client = this.getClient(input.workspaceId)
    const config = this.getConfig(input.workspaceId)

    // Parse the Linear issue identifier from the entity ID
    // ID format: linear:tasks:TEAM_KEY:IDENTIFIER
    const idParts = input.entityId.split(":")
    // The identifier (e.g. "PIPER-42") is the last segment
    const identifier = idParts.length >= 4 ? idParts[3]! : idParts.slice(2).join(":")

    // Fetch the issue to get the UUID
    const issue = await client.getIssue(identifier)

    const response = await client.createComment(issue.id, input.body)

    const comment: CommentRef = {
      id: `comment:linear:${identifier}:${response.id}`,
      externalId: response.id,
      threadId: identifier,
      parentCommentId: undefined,
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body,
      bodyFormat: input.bodyFormat ?? "markdown",
      author: mapLinearUser(response.user ?? null),
      createdAt: response.createdAt,
      updatedAt: response.updatedAt !== response.createdAt ? response.updatedAt : undefined,
      edited: response.updatedAt !== response.createdAt,
      mentions: [],
    }

    const existing = this.localComments.get(input.entityId) ?? []
    existing.push(comment)
    this.localComments.set(input.entityId, existing)

    return comment
  }
}
