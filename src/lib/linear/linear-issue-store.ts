/**
 * LinearIssueStore — IssueStore implementation backed by Linear GraphQL API.
 *
 * Implements full CRUD for tasks and projects, comment management, people
 * discovery, and watermark-based sync.  Follows the same adapter pattern as
 * the MS Lists and InMemory backends.
 *
 * NEV-22 / Phase 5 — Linear integration for Piper.
 */

import type { CommentRef } from "@/features/comments/types"
import type { PersonRef } from "@/features/people/types"
import type { WorkspaceProject } from "@/features/projects/types"
import type { WorkspaceTask } from "@/features/tasks/types"
import type { WorkspaceConfig } from "@/features/workspaces/types"

import type {
  BackendConfig,
  ChangeSet,
  CreateCommentInput,
  CreateTaskInput,
  IssueStore,
  PaginatedResult,
  ProjectQuery,
  StoreCapabilities,
  SyncWatermark,
  TaskPatch,
  TaskQuery,
} from "@/lib/store/types"

import {
  collectPeopleFromLinearEntities,
  mapLinearCommentToCommentRef,
  mapLinearIssueToWorkspaceTask,
  mapLinearProjectToWorkspaceProject,
  mapLinearUser,
} from "./linear-adapter"
import { LinearClient, fetchAllPages } from "./linear-client"
import type { LinearIssue, LinearProject, LinearWorkflowState } from "./linear-types"

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

export interface LinearBackendConfig extends BackendConfig {
  /** Workspace config that maps Linear fields to Piper schema. */
  workspaceConfig: WorkspaceConfig
  /** Linear Personal API Key. */
  apiKey: string
  /** Optional API base URL override (for testing). */
  baseUrl?: string
  /** Optional custom fetch (for testing). */
  fetchImpl?: typeof globalThis.fetch
}

// ---------------------------------------------------------------------------
// LinearIssueStore
// ---------------------------------------------------------------------------

export class LinearIssueStore implements IssueStore {
  readonly backendId = "linear"

  readonly capabilities: StoreCapabilities = {
    supportsOffline: false,
    supportsDeltaQuery: true,
    supportsWebhooks: true,
    supportsBatchOperations: false,
    supportsRichText: true,
    supportsHierarchy: true,
    maxPageSize: 100,
    writeLatency: "immediate",
  }

  private client: LinearClient | null = null
  private workspaceConfig: WorkspaceConfig | null = null

  // Local caches
  private taskCache = new Map<string, WorkspaceTask>()
  private projectCache = new Map<string, WorkspaceProject>()
  private commentCache = new Map<string, CommentRef[]>()
  private peopleCache: PersonRef[] = []

  // Workflow state cache (team ID -> states)
  private workflowStateCache = new Map<string, LinearWorkflowState[]>()

  // Sync watermark
  private watermark: SyncWatermark | null = null

  // Initialization state
  private initialized = false

  // -- Lifecycle ------------------------------------------------------------

  async initialize(config: BackendConfig): Promise<void> {
    const linearConfig = config as LinearBackendConfig

    if (!linearConfig.workspaceConfig) {
      throw new Error(
        "LinearIssueStore: workspaceConfig is required in BackendConfig.",
      )
    }
    if (!linearConfig.apiKey) {
      throw new Error(
        "LinearIssueStore: apiKey is required in BackendConfig.",
      )
    }

    this.workspaceConfig = linearConfig.workspaceConfig

    this.client = new LinearClient({
      baseUrl: linearConfig.baseUrl,
      accessTokenProvider: async () => linearConfig.apiKey!,
      fetch: linearConfig.fetchImpl,
    })

    // Warm up caches on init
    await this.refreshAll()
    this.initialized = true
  }

  async dispose(): Promise<void> {
    this.taskCache.clear()
    this.projectCache.clear()
    this.commentCache.clear()
    this.peopleCache = []
    this.workflowStateCache.clear()
    this.watermark = null
    this.client = null
    this.workspaceConfig = null
    this.initialized = false
  }

  // -- Read -----------------------------------------------------------------

  async listTasks(query: TaskQuery): Promise<PaginatedResult<WorkspaceTask>> {
    this.ensureInitialized()

    let items = Array.from(this.taskCache.values())

    // Filtering
    if (query.projectId !== undefined) {
      items = items.filter((t) => t.projectId === query.projectId)
    }
    if (query.assigneeId !== undefined) {
      items = items.filter((t) => t.assignee?.id === query.assigneeId)
    }
    if (query.statuses !== undefined && query.statuses.length > 0) {
      items = items.filter((t) => query.statuses!.includes(t.status))
    }
    if (query.parentTaskId !== undefined) {
      items = items.filter((t) => t.parentTaskId === query.parentTaskId)
    }
    if (query.labels !== undefined && query.labels.length > 0) {
      items = items.filter((t) =>
        query.labels!.some((l) => t.labels.includes(l)),
      )
    }
    if (query.search) {
      const lower = query.search.toLowerCase()
      items = items.filter(
        (t) =>
          t.title.toLowerCase().includes(lower) ||
          t.description.toLowerCase().includes(lower),
      )
    }
    if (!query.includeCompleted) {
      items = items.filter((t) => t.status !== "done")
    }

    // Sort
    if (query.sortField) {
      const dir = query.sortDirection === "desc" ? -1 : 1
      items.sort((a, b) => {
        const av = (a as Record<string, unknown>)[query.sortField!]
        const bv = (b as Record<string, unknown>)[query.sortField!]
        if (typeof av === "number" && typeof bv === "number") {
          return (av - bv) * dir
        }
        return String(av ?? "").localeCompare(String(bv ?? "")) * dir
      })
    }

    // Pagination
    const offset = query.offset ?? 0
    const limit = Math.min(query.limit ?? this.capabilities.maxPageSize, this.capabilities.maxPageSize)
    const page = items.slice(offset, offset + limit)

    return {
      items: page,
      total: items.length,
      offset,
      limit,
      hasMore: offset + limit < items.length,
    }
  }

  async getTask(id: string): Promise<WorkspaceTask | null> {
    this.ensureInitialized()
    return this.taskCache.get(id) ?? null
  }

  async listProjects(
    query: ProjectQuery,
  ): Promise<PaginatedResult<WorkspaceProject>> {
    this.ensureInitialized()

    let items = Array.from(this.projectCache.values())

    if (query.parentProjectId !== undefined) {
      items = items.filter((p) => p.parentProjectId === query.parentProjectId)
    }
    if (query.statuses !== undefined && query.statuses.length > 0) {
      items = items.filter((p) => query.statuses!.includes(p.status))
    }
    if (!query.includeCompleted) {
      items = items.filter((p) => p.status !== "complete")
    }

    const offset = query.offset ?? 0
    const limit = Math.min(query.limit ?? this.capabilities.maxPageSize, this.capabilities.maxPageSize)
    const page = items.slice(offset, offset + limit)

    return {
      items: page,
      total: items.length,
      offset,
      limit,
      hasMore: offset + limit < items.length,
    }
  }

  async getProject(id: string): Promise<WorkspaceProject | null> {
    this.ensureInitialized()
    return this.projectCache.get(id) ?? null
  }

  async listComments(entityId: string): Promise<CommentRef[]> {
    this.ensureInitialized()
    return this.commentCache.get(entityId) ?? []
  }

  async listPeople(): Promise<PersonRef[]> {
    this.ensureInitialized()
    return [...this.peopleCache]
  }

  // -- Write ----------------------------------------------------------------

  async createTask(input: CreateTaskInput): Promise<WorkspaceTask> {
    this.ensureInitialized()
    const config = this.requireConfig()
    const client = this.requireClient()

    // Resolve team ID — use first configured team key
    const teamKeys = this.extractTeamKeys()
    const viewer = await client.getViewer()
    const teams = viewer.teams.nodes
    const targetTeam = teams.find((t) => teamKeys.includes(t.key)) ?? teams[0]
    if (!targetTeam) {
      throw new Error("No Linear team found for the configured workspace.")
    }

    const createPayload: Record<string, unknown> = {
      title: input.title,
      teamId: targetTeam.id,
    }

    if (input.description) createPayload.description = input.description
    if (input.dueDate) createPayload.dueDate = input.dueDate
    if (input.priority) {
      createPayload.priority = piperPriorityToLinear(input.priority)
    }
    if (input.status) {
      const stateId = await this.findWorkflowStateId(
        targetTeam.id,
        input.status,
      )
      if (stateId) createPayload.stateId = stateId
    }

    const issue = await client.createIssue(createPayload as any)
    const task = mapLinearIssueToWorkspaceTask({ workspaceConfig: config, issue })

    this.taskCache.set(task.id, task)
    return task
  }

  async updateTask(id: string, patch: TaskPatch): Promise<WorkspaceTask> {
    this.ensureInitialized()
    const config = this.requireConfig()
    const client = this.requireClient()

    // Parse identifier from Piper task ID: "linear:tasks:TEAM_KEY:IDENTIFIER"
    const identifier = this.parseIdentifier(id)

    // Fetch current issue to get the Linear UUID and team info
    const currentIssue = await client.getIssue(identifier)

    const updatePayload: Record<string, unknown> = {}

    if (patch.title !== undefined) updatePayload.title = patch.title
    if (patch.description !== undefined) updatePayload.description = patch.description

    // Handle status change -> stateId
    if (patch.status !== undefined) {
      const stateId = await this.findWorkflowStateId(
        currentIssue.team.id,
        patch.status,
      )
      if (stateId) updatePayload.stateId = stateId
    }

    // Handle priority
    if (patch.priority !== undefined) {
      updatePayload.priority = piperPriorityToLinear(patch.priority)
    }

    // Handle due date
    if (patch.dueDate !== undefined) {
      updatePayload.dueDate = patch.dueDate
    }

    // Handle assignee
    if (patch.assigneeId !== undefined) {
      updatePayload.assigneeId = patch.assigneeId ?? null
    }

    if (Object.keys(updatePayload).length > 0) {
      await client.updateIssue(currentIssue.id, updatePayload)
    }

    // Re-fetch to get updated state
    const updatedIssue = await client.getIssue(currentIssue.id)
    const task = mapLinearIssueToWorkspaceTask({ workspaceConfig: config, issue: updatedIssue })

    this.taskCache.set(id, task)
    return task
  }

  async deleteTask(id: string): Promise<void> {
    this.ensureInitialized()

    // Linear does not have a hard-delete API for issues.
    // We simulate deletion by moving the issue to a "canceled" state
    // and removing it from the local cache.
    const client = this.requireClient()
    const config = this.requireConfig()
    const identifier = this.parseIdentifier(id)
    const issue = await client.getIssue(identifier)

    // Find the "canceled" workflow state
    const states = await this.getWorkflowStatesForTeam(issue.team.id)
    const canceledState = states.find((s) => s.type === "canceled")

    if (canceledState) {
      await client.updateIssue(issue.id, { stateId: canceledState.id })
    }

    this.taskCache.delete(id)
    this.commentCache.delete(id)
  }

  async createComment(input: CreateCommentInput): Promise<CommentRef> {
    this.ensureInitialized()
    const client = this.requireClient()
    const config = this.requireConfig()

    // Parse identifier from entity ID: "linear:tasks:TEAM_KEY:IDENTIFIER"
    const identifier = this.parseIdentifier(input.entityId)

    // Fetch the issue to get the Linear UUID
    const issue = await client.getIssue(identifier)

    const response = await client.createComment(issue.id, input.body)

    const comment: CommentRef = mapLinearCommentToCommentRef({
      workspaceConfig: config,
      comment: response,
      entityType: input.entityType,
    })

    // Cache the comment
    const existing = this.commentCache.get(input.entityId) ?? []
    existing.push(comment)
    this.commentCache.set(input.entityId, existing)

    return comment
  }

  // -- Sync -----------------------------------------------------------------

  async getChangesSince(watermark: SyncWatermark): Promise<ChangeSet> {
    this.ensureInitialized()

    // Full refresh strategy — diff against previous cache.
    const previousTasks = new Map(this.taskCache)
    await this.refreshAll()

    const created: WorkspaceTask[] = []
    const updated: Array<{ task: WorkspaceTask; changedFields: string[] }> = []
    const deleted: string[] = []

    // Detect new and updated
    for (const [id, task] of this.taskCache) {
      if (!previousTasks.has(id)) {
        created.push(task)
      } else {
        const prev = previousTasks.get(id)!
        const changed = detectChangedFields(prev, task)
        if (changed.length > 0) {
          updated.push({ task, changedFields: changed })
        }
      }
    }

    // Detect deleted
    for (const id of previousTasks.keys()) {
      if (!this.taskCache.has(id)) {
        deleted.push(id)
      }
    }

    const newWatermark = await this.getWatermark()

    return { created, updated, deleted, watermark: newWatermark }
  }

  async getWatermark(): Promise<SyncWatermark> {
    const now = new Date().toISOString()
    this.watermark = {
      backendId: this.backendId,
      timestamp: now,
    }
    return this.watermark
  }

  // -- Internal helpers -----------------------------------------------------

  private ensureInitialized(): void {
    if (!this.initialized || !this.client || !this.workspaceConfig) {
      throw new Error(
        "LinearIssueStore has not been initialized. Call initialize() first.",
      )
    }
  }

  private requireConfig(): WorkspaceConfig {
    if (!this.workspaceConfig) throw new Error("Store not initialized.")
    return this.workspaceConfig
  }

  private requireClient(): LinearClient {
    if (!this.client) throw new Error("Store not initialized.")
    return this.client
  }

  private extractTeamKeys(): string[] {
    const config = this.requireConfig()
    return config.lists.tasks.list.id.split(",").map((s) => s.trim())
  }

  /**
   * Parse the Linear issue identifier from a Piper task ID.
   * ID format: "linear:tasks:TEAM_KEY:IDENTIFIER" -> "IDENTIFIER"
   * e.g. "linear:tasks:PIPER:PIPER-1" -> "PIPER-1"
   */
  private parseIdentifier(piperTaskId: string): string {
    const parts = piperTaskId.split(":")
    if (parts.length >= 4 && parts[0] === "linear") {
      // The identifier (parts[3]) already includes the team key prefix
      return parts[3]
    }
    // Fallback: treat as raw identifier
    return piperTaskId
  }

  /**
   * Get workflow states for a team, with caching.
   */
  private async getWorkflowStatesForTeam(teamId: string): Promise<LinearWorkflowState[]> {
    const cached = this.workflowStateCache.get(teamId)
    if (cached) return cached

    const client = this.requireClient()
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
    teamId: string,
    targetStatus: WorkspaceTask["status"],
  ): Promise<string | undefined> {
    const states = await this.getWorkflowStatesForTeam(teamId)

    const typeMap: Record<string, LinearWorkflowState["type"][]> = {
      backlog: ["backlog"],
      planned: ["unstarted", "triage"],
      "in-progress": ["started"],
      "in-review": ["started"],
      blocked: ["unstarted"],
      done: ["completed", "canceled"],
    }

    const targetTypes = typeMap[targetStatus] ?? []
    const match = states.find((s) => targetTypes.includes(s.type))
    return match?.id
  }

  /**
   * Refresh all caches from the Linear API.
   */
  private async refreshAll(): Promise<void> {
    const config = this.requireConfig()
    const client = this.requireClient()
    const teamKeys = this.extractTeamKeys()

    // Fetch issues for all configured teams
    const tasks: WorkspaceTask[] = []
    const linearIssues: LinearIssue[] = []

    for (const teamKey of teamKeys) {
      const filter: Record<string, unknown> = {
        team: { key: { eq: teamKey } },
      }

      const issues = await fetchAllPages((after) =>
        client.listIssues(filter, after, 100),
      )

      for (const issue of issues) {
        linearIssues.push(issue)
        tasks.push(mapLinearIssueToWorkspaceTask({ workspaceConfig: config, issue }))
      }
    }

    // Fetch projects for all teams
    const projects: WorkspaceProject[] = []
    const seenProjectIds = new Set<string>()

    for (const teamKey of teamKeys) {
      const filter: Record<string, unknown> = {
        team: { key: { eq: teamKey } },
      }

      const linearProjects = await fetchAllPages((after) =>
        client.listProjects(filter, after, 50),
      )

      for (const project of linearProjects) {
        if (seenProjectIds.has(project.id)) continue
        seenProjectIds.add(project.id)
        projects.push(mapLinearProjectToWorkspaceProject({ workspaceConfig: config, project }))
      }
    }

    // Fetch comments for issues (limit to prevent excessive API calls)
    const comments: CommentRef[] = []
    const issuesToFetch = linearIssues.slice(0, 50)

    for (const issue of issuesToFetch) {
      try {
        const linearComments = await fetchAllPages((after) =>
          client.listComments(issue.id, after),
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

    // Update caches
    this.taskCache.clear()
    this.projectCache.clear()
    this.commentCache.clear()

    for (const task of tasks) {
      this.taskCache.set(task.id, task)
    }
    for (const project of projects) {
      this.projectCache.set(project.id, project)
    }

    // Index comments by entity ID
    for (const comment of comments) {
      const existing = this.commentCache.get(comment.entityId) ?? []
      existing.push(comment)
      this.commentCache.set(comment.entityId, existing)
    }

    // Derive people from all entities
    this.peopleCache = collectPeopleFromLinearEntities({
      projects,
      tasks,
      comments,
    })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function piperPriorityToLinear(priority: WorkspaceTask["priority"]): number {
  switch (priority) {
    case "urgent":
      return 1
    case "high":
      return 2
    case "medium":
      return 3
    case "low":
      return 4
    default:
      return 0
  }
}

function detectChangedFields(
  prev: WorkspaceTask,
  next: WorkspaceTask,
): string[] {
  const fields: (keyof WorkspaceTask)[] = [
    "title",
    "description",
    "status",
    "priority",
    "projectId",
    "assignee",
    "labels",
    "dueDate",
    "startDate",
  ]

  return fields.filter((field) => {
    const a = prev[field]
    const b = next[field]
    return JSON.stringify(a) !== JSON.stringify(b)
  })
}
