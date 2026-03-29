/**
 * GitHub Issues-backed PiperRepository implementation.
 *
 * Implements the same PiperRepository interface used by the Graph and Jira adapters,
 * but backed by the GitHub REST API v3.
 * Supports multi-repo: the list.id field can contain comma-separated "owner/repo" identifiers.
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

import { GitHubClient } from "./github-client"
import {
  applyProjectTaskAggregates,
  buildGitHubBackedWorkspace,
  collectPeopleFromGitHubEntities,
  mapGitHubCommentToCommentRef,
  mapGitHubIssueToWorkspaceTask,
  mapGitHubRepoToWorkspaceProject,
} from "./github-adapter"

// ── Config Helpers ─────────────────────────────────────────────────────────

function extractApiBaseUrl(workspaceConfig: WorkspaceConfig): string {
  // The site.id in a GitHub workspace config holds the API base URL
  // (e.g., "https://api.github.com" or "https://github.myenterprise.com/api/v3")
  return workspaceConfig.lists.tasks.site.id
}

function extractRepoFullNames(config: WorkspaceConfig): { tasks: string[]; projects: string[] } {
  return {
    tasks: config.lists.tasks.list.id.split(",").map((s) => s.trim()),
    projects: config.lists.projects.list.id.split(",").map((s) => s.trim()),
  }
}

function parseRepoFullName(fullName: string): { owner: string; repo: string } {
  const parts = fullName.split("/")
  return { owner: parts[0] ?? "", repo: parts[1] ?? "" }
}

// ── Repository ─────────────────────────────────────────────────────────────

export class GitHubPiperRepository implements PiperRepository {
  private readonly workspaceConfigs: WorkspaceConfig[]
  private readonly githubClients: Map<string, GitHubClient>
  private readonly localTaskOverrides = new Map<string, Partial<WorkspaceTask>>()
  private readonly localComments = new Map<string, CommentRef[]>()

  constructor(options: {
    workspaceConfigs: WorkspaceConfig[]
    accessTokenProvider?: () => Promise<string>
    fetchImpl?: typeof globalThis.fetch
  }) {
    this.workspaceConfigs = options.workspaceConfigs
    this.githubClients = new Map()

    for (const config of this.workspaceConfigs) {
      const baseUrl = extractApiBaseUrl(config)
      const client = new GitHubClient({
        baseUrl,
        accessTokenProvider: options.accessTokenProvider,
        fetch: options.fetchImpl,
      })
      this.githubClients.set(config.workspace.id, client)
    }
  }

  // ── Private Helpers ──────────────────────────────────────────────────────

  private getConfig(workspaceId: string): WorkspaceConfig {
    const config = this.workspaceConfigs.find((c) => c.workspace.id === workspaceId)
    if (!config) throw new Error(`No GitHub workspace config found for '${workspaceId}'.`)
    return config
  }

  private getClient(workspaceId: string): GitHubClient {
    const client = this.githubClients.get(workspaceId)
    if (!client) throw new Error(`No GitHub client found for workspace '${workspaceId}'.`)
    return client
  }

  private async fetchAllIssuesForRepos(
    workspaceId: string,
    repoFullNames: string[],
    state: "open" | "closed" | "all" = "all",
  ): Promise<WorkspaceTask[]> {
    const config = this.getConfig(workspaceId)
    const client = this.getClient(workspaceId)
    const tasks: WorkspaceTask[] = []

    for (const fullName of repoFullNames) {
      const { owner, repo } = parseRepoFullName(fullName)
      let page = 1
      let hasMore = true

      while (hasMore) {
        const response = await client.listIssues(owner, repo, {
          state,
          sort: "updated",
          direction: "desc",
          page,
          per_page: 100,
        })

        for (const issue of response.data) {
          // Skip pull requests — only map actual issues
          if (issue.pull_request) continue
          tasks.push(mapGitHubIssueToWorkspaceTask({ workspaceConfig: config, issue }))
        }

        hasMore = response.nextPage !== null
        page = response.nextPage ?? page + 1
      }
    }

    return tasks
  }

  private async fetchWorkspaceProjects(workspaceId: string): Promise<WorkspaceProject[]> {
    const config = this.getConfig(workspaceId)
    const client = this.getClient(workspaceId)
    const repoNames = extractRepoFullNames(config)

    const projects: WorkspaceProject[] = []
    const seen = new Set<string>()

    // Combine unique repos from both tasks and projects config
    const allRepos = [...new Set([...repoNames.tasks, ...repoNames.projects])]

    for (const fullName of allRepos) {
      if (seen.has(fullName)) continue
      seen.add(fullName)

      const { owner, repo } = parseRepoFullName(fullName)
      try {
        const repository = await client.getRepository(owner, repo)
        projects.push(mapGitHubRepoToWorkspaceProject({ workspaceConfig: config, repository }))
      } catch {
        // If repo can't be fetched, create a minimal stub
        projects.push({
          id: `github:projects:${fullName}:${fullName}`,
          externalId: fullName,
          workspaceId: config.workspace.id,
          projectCode: fullName,
          title: fullName,
          description: "",
          status: "active",
          health: { status: "on-track", summary: "GitHub repository." },
          owner: { id: "unknown", externalId: "unknown", displayName: "Unknown", email: "unknown@github.local" },
          collaborators: [],
          labels: [],
          path: [fullName],
          milestoneIds: [],
          milestones: [],
          taskIds: [],
          taskCount: 0,
          openTaskCount: 0,
          priority: "medium",
          progressPercent: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      }
    }

    return projects
  }

  private async fetchAllCommentsForRepos(
    workspaceId: string,
    tasks: WorkspaceTask[],
  ): Promise<CommentRef[]> {
    const config = this.getConfig(workspaceId)
    const client = this.getClient(workspaceId)
    const comments: CommentRef[] = []

    // Only fetch comments for issues that have them (issue.comments > 0)
    const tasksWithComments = tasks.filter((t) => t.externalId)

    for (const task of tasksWithComments.slice(0, 50)) {
      // Limit to prevent excessive API calls
      const idParts = task.id.split(":")
      const repoFullName = idParts.slice(2, 4).join("/")
      const issueNumber = parseInt(task.externalId!, 10)
      const { owner, repo } = parseRepoFullName(repoFullName)

      try {
        const response = await client.listComments(owner, repo, issueNumber)
        for (const ghComment of response.data) {
          comments.push(
            mapGitHubCommentToCommentRef({
              workspaceConfig: config,
              repoFullName,
              issueNumber,
              entityType: "task",
              comment: ghComment,
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
          this.fetchAllIssuesForRepos(config.workspace.id, extractRepoFullNames(config).tasks),
        ])
        workspaces.push(buildGitHubBackedWorkspace({ workspaceConfig: config, projects, tasks }))
      } catch {
        workspaces.push({
          id: config.workspace.id,
          slug: config.workspace.id,
          name: config.workspace.label,
          description: config.workspace.description ?? "GitHub Issues workspace (error loading).",
          tenantName: config.workspace.tenant.label,
          mode: "github" as PiperWorkspace["mode"],
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
    if (!config) throw new Error("No GitHub workspace configurations available.")

    const [projects, tasks] = await Promise.all([
      this.fetchWorkspaceProjects(config.workspace.id),
      this.fetchAllIssuesForRepos(config.workspace.id, extractRepoFullNames(config).tasks),
    ])

    return buildGitHubBackedWorkspace({ workspaceConfig: config, projects, tasks })
  }

  async listWorkspacePeople(workspaceId: string): Promise<PersonRef[]> {
    const [projects, tasks, comments] = await Promise.all([
      this.fetchWorkspaceProjects(workspaceId),
      this.fetchAllIssuesForRepos(workspaceId, extractRepoFullNames(this.getConfig(workspaceId)).tasks),
      Promise.resolve([] as CommentRef[]),
    ])

    const allComments = await this.fetchAllCommentsForRepos(workspaceId, tasks)

    return collectPeopleFromGitHubEntities({ projects, tasks, comments: allComments })
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
    const repoNames = extractRepoFullNames(config)

    // Determine state filter
    const state: "open" | "closed" | "all" = query.includeCompleted ? "all" : "open"

    let tasks = await this.fetchAllIssuesForRepos(query.workspaceId, repoNames.tasks, state)

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
    const allComments = await this.fetchAllCommentsForRepos(query.workspaceId, tasks)
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
    const repoNames = extractRepoFullNames(config)
    const tasks = await this.fetchAllIssuesForRepos(workspaceId, repoNames.tasks)
    const remoteComments = await this.fetchAllCommentsForRepos(workspaceId, tasks)
    const localComments = Array.from(this.localComments.values()).flat()
    return [...remoteComments, ...localComments]
  }

  async updateTask(input: TaskUpdateInput): Promise<WorkspaceTask> {
    const config = this.getConfig(input.workspaceId)
    const client = this.getClient(input.workspaceId)

    // Extract GitHub issue number and repo from task ID
    // ID format: github:tasks:OWNER/REPO:ISSUE_NUMBER
    const idParts = input.taskId.split(":")
    const repoFullName = idParts.slice(2, 4).join("/")
    const issueNumber = parseInt(idParts[4] ?? "0", 10)
    const { owner, repo } = parseRepoFullName(repoFullName)

    const updatePayload: Record<string, unknown> = {}

    if (input.patch.title !== undefined) updatePayload.title = input.patch.title
    if (input.patch.description !== undefined) updatePayload.body = input.patch.description
    if (input.patch.labels !== undefined) updatePayload.labels = input.patch.labels

    // Handle status change
    if (input.patch.status !== undefined) {
      if (input.patch.status === "done") {
        updatePayload.state = "closed"
      } else if (["planned", "in-progress", "blocked", "in-review", "backlog"].includes(input.patch.status)) {
        updatePayload.state = "open"
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      await client.updateIssue(owner, repo, issueNumber, updatePayload)
    }

    // Store local override for immediate UI update
    this.localTaskOverrides.set(input.taskId, input.patch)

    const updatedTask = await this.getTaskByIssueNumber(input.workspaceId, owner, repo, issueNumber)
    return { ...updatedTask, ...input.patch }
  }

  async createTask(input: CreateTaskInput): Promise<WorkspaceTask> {
    const config = this.getConfig(input.workspaceId)
    const client = this.getClient(input.workspaceId)
    const repoNames = extractRepoFullNames(config)

    // Determine target repo
    let targetRepo = repoNames.tasks[0]!
    if (input.projectId) {
      const idParts = input.projectId.split(":")
      const projectRepo = idParts.slice(2, 4).join("/")
      if (repoNames.tasks.includes(projectRepo)) {
        targetRepo = projectRepo
      }
    }

    const { owner, repo } = parseRepoFullName(targetRepo)

    const createPayload: Record<string, unknown> = {
      title: input.title,
    }

    if (input.description) createPayload.body = input.description
    if (input.dueDate) createPayload.body = `${createPayload.body ?? ""}\n\n**Due:** ${input.dueDate}`
    if (input.labels?.length) createPayload.labels = input.labels

    const response = await client.createIssue(owner, repo, createPayload)

    return this.getTaskByIssueNumber(input.workspaceId, owner, repo, response.number)
  }

  async createComment(input: CreateCommentInput): Promise<CommentRef> {
    const config = this.getConfig(input.workspaceId)
    const client = this.getClient(input.workspaceId)

    // Extract repo and issue number from entity ID
    const idParts = input.entityId.split(":")
    const repoFullName = idParts.slice(2, 4).join("/")
    const issueNumber = parseInt(idParts[4] ?? "0", 10)
    const { owner, repo } = parseRepoFullName(repoFullName)

    const response = await client.createComment(owner, repo, issueNumber, input.body)

    const comment: CommentRef = {
      id: `comment:github:${repoFullName}:${issueNumber}:${response.id}`,
      externalId: String(response.id),
      threadId: `${repoFullName}:${issueNumber}`,
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body,
      bodyFormat: input.bodyFormat ?? "markdown",
      author: mapGitHubUser(response.user),
      createdAt: response.created_at,
      updatedAt: response.updated_at !== response.created_at ? response.updated_at : undefined,
      edited: response.updated_at !== response.created_at,
      mentions: [],
    }

    const existing = this.localComments.get(input.entityId) ?? []
    existing.push(comment)
    this.localComments.set(input.entityId, existing)

    return comment
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private async getTaskByIssueNumber(
    workspaceId: string,
    owner: string,
    repo: string,
    issueNumber: number,
  ): Promise<WorkspaceTask> {
    const config = this.getConfig(workspaceId)
    const client = this.getClient(workspaceId)

    const issue = await client.getIssue(owner, repo, issueNumber)
    return mapGitHubIssueToWorkspaceTask({ workspaceConfig: config, issue })
  }
}
