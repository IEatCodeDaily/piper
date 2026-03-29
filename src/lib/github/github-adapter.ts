/**
 * Mapping functions: GitHub Issues API payloads → Piper domain types.
 *
 * All mapping is config-driven: field names come from `WorkspaceListConfig.fields[].sourceField`.
 */

import type { CommentRef } from "@/features/comments/types"
import type { PersonRef } from "@/features/people/types"
import type { WorkspaceProject } from "@/features/projects/types"
import type { WorkspaceTask } from "@/features/tasks/types"
import type { WorkspaceConfig, WorkspaceListConfig } from "@/features/workspaces/types"
import type { PiperWorkspace } from "@/lib/domain/workspace"
import type { GitHubIssue, GitHubComment, GitHubUser, GitHubRepository, GitHubLabel } from "./github-types"

// ── Entity IDs ─────────────────────────────────────────────────────────────

/**
 * Create a stable entity ID from GitHub coordinates.
 * Format: github:tasks:OWNER/REPO:ISSUE_NUMBER or github:projects:OWNER/REPO:REPO
 */
function createEntityId(scope: "tasks" | "projects", repoFullName: string, itemIdentifier: string | number) {
  return `github:${scope}:${repoFullName}:${itemIdentifier}`
}

// ── Person Mapping ─────────────────────────────────────────────────────────

export function mapGitHubUser(user: GitHubUser | null | undefined, fallbackName = "Unknown person"): PersonRef {
  if (!user) {
    return {
      id: "unknown",
      externalId: "unknown",
      displayName: fallbackName,
      email: "unknown@github.local",
    }
  }

  return {
    id: String(user.id),
    externalId: user.login,
    displayName: user.name ?? user.login,
    email: user.email ?? `${user.login}@users.noreply.github.com`,
    avatarUrl: user.avatar_url,
  }
}

// ── Status Mapping ─────────────────────────────────────────────────────────

function normalizeTaskStatus(
  state: "open" | "closed" | undefined,
  labels: (GitHubLabel | string)[] | undefined,
): WorkspaceTask["status"] {
  // Check for label-based status overrides first (common in GitHub projects)
  const labelNames = (labels ?? []).map((l) =>
    typeof l === "string" ? l.toLowerCase().trim() : (l?.name?.toLowerCase().trim() ?? ""),
  ).filter(Boolean)

  if (labelNames.includes("blocked")) return "blocked"
  if (labelNames.includes("in-review") || labelNames.includes("review")) return "in-review"
  if (labelNames.includes("in-progress") || labelNames.includes("wip")) return "in-progress"
  if (labelNames.includes("backlog")) return "backlog"
  if (labelNames.includes("planned") || labelNames.includes("todo")) return "planned"

  // Fall back to state
  if (state === "closed") return "done"
  return "planned"
}

// ── Priority Mapping ───────────────────────────────────────────────────────

function normalizeTaskPriority(
  labels: (GitHubLabel | string)[] | undefined,
): WorkspaceTask["priority"] {
  const labelNames = (labels ?? []).map((l) =>
    typeof l === "string" ? l.toLowerCase().trim() : (l?.name?.toLowerCase().trim() ?? ""),
  ).filter(Boolean)

  if (labelNames.some((l) => ["critical", "blocker", "urgent", "p0"].includes(l))) return "urgent"
  if (labelNames.some((l) => ["high", "high-priority", "p1"].includes(l))) return "high"
  if (labelNames.some((l) => ["medium", "p2"].includes(l))) return "medium"

  return "low"
}

function normalizeProjectPriority(
  labels: (GitHubLabel | string)[] | undefined,
): WorkspaceProject["priority"] {
  const p = normalizeTaskPriority(labels)
  return p === "urgent" ? "urgent" : p
}

// ── Label Extraction ──────────────────────────────────────────────────────

function extractLabelNames(labels: (GitHubLabel | string)[] | undefined): string[] {
  return (labels ?? [])
    .map((l) => (typeof l === "string" ? l : l.name))
    .filter(Boolean)
}

// ── Field Lookup ───────────────────────────────────────────────────────────

function getSourceField(listConfig: WorkspaceListConfig, semanticField: string) {
  return listConfig.fields[semanticField]?.sourceField
}

function getFieldValue(
  issue: GitHubIssue,
  listConfig: WorkspaceListConfig,
  semanticField: string,
): unknown {
  const sourceField = getSourceField(listConfig, semanticField)
  if (!sourceField) return undefined

  const issueRecord = issue as unknown as Record<string, unknown>
  const parts = sourceField.split(".")
  let value: unknown = issueRecord
  for (const part of parts) {
    if (value == null || typeof value !== "object") return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return value
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  return undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

// ── Repo FullName Helper ──────────────────────────────────────────────────

function getRepoFullName(issue: GitHubIssue): string {
  if (issue.repository_url) {
    // repository_url: "https://api.github.com/repos/owner/repo"
    const parts = issue.repository_url.split("/")
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
  }
  return "unknown/unknown"
}

// ── Task Mapping ───────────────────────────────────────────────────────────

export function mapGitHubIssueToWorkspaceTask(args: {
  workspaceConfig: WorkspaceConfig
  issue: GitHubIssue
}): WorkspaceTask {
  const taskListConfig = args.workspaceConfig.lists.tasks
  const issue = args.issue
  const repoFullName = getRepoFullName(issue)

  // Skip pull requests — only map actual issues
  const isPR = issue.pull_request !== undefined

  const title = asString(getFieldValue(issue, taskListConfig, "title")) ?? issue.title ?? "Untitled task"

  // Status
  const statusField = getFieldValue(issue, taskListConfig, "status")
  const statusString = typeof statusField === "string" ? statusField : issue.state
  const status = normalizeTaskStatus(
    statusString === "open" || statusString === "closed" ? statusString : undefined,
    issue.labels,
  )

  // Priority (label-based for GitHub)
  const priority = normalizeTaskPriority(issue.labels)

  // Assignee
  const assignee = mapGitHubUser(issue.assignee ?? null)

  // Reporter / creator
  const reporter = mapGitHubUser(issue.user ?? null)

  // Description
  const description = issue.body ?? ""

  // Dates
  const startDate = asString(getFieldValue(issue, taskListConfig, "startDate")) ?? undefined
  const dueDate =
    asString(getFieldValue(issue, taskListConfig, "dueDate")) ??
    issue.milestone?.due_on ??
    undefined

  // Labels
  const labels = extractLabelNames(issue.labels)

  // Project code from repo
  const projectCode = repoFullName

  // Milestone
  const estimatePoints = asNumber(getFieldValue(issue, taskListConfig, "estimatePoints"))

  const createdBy = mapGitHubUser(issue.user ?? null, "Unknown creator")
  const modifiedBy = mapGitHubUser(issue.user ?? null, "Unknown modifier")

  return {
    id: createEntityId("tasks", repoFullName, issue.number),
    externalId: String(issue.number),
    workspaceId: args.workspaceConfig.workspace.id,
    title,
    status,
    priority,
    description,
    assignee,
    reporter,
    watchers: [],
    projectId: createEntityId("projects", repoFullName, repoFullName),
    projectCode,
    parentTaskId: undefined,
    path: [title],
    labels,
    startDate,
    dueDate,
    completedAt: issue.closed_at ?? undefined,
    estimatePoints,
    remainingPoints: undefined,
    sortOrder: 0,
    checklist: [],
    attachments: [],
    commentIds: [],
    comments: [],
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    createdBy,
    modifiedBy,
    // Extension: mark if this is a PR (for UI filtering)
    _isPullRequest: isPR,
  } as WorkspaceTask & { _isPullRequest?: boolean }
}

// ── Project Mapping ────────────────────────────────────────────────────────

export function mapGitHubRepoToWorkspaceProject(args: {
  workspaceConfig: WorkspaceConfig
  repository: GitHubRepository
}): WorkspaceProject {
  const repo = args.repository
  const title = repo.name

  return {
    id: createEntityId("projects", repo.full_name, repo.full_name),
    externalId: repo.full_name,
    workspaceId: args.workspaceConfig.workspace.id,
    projectCode: repo.full_name,
    title,
    description: repo.description ?? "",
    status: repo.private ? "active" : "active",
    health: { status: "on-track", summary: `GitHub repository: ${repo.open_issues_count} open issues.` },
    owner: mapGitHubUser(repo.owner),
    collaborators: [],
    startDate: undefined,
    targetDate: undefined,
    completedAt: undefined,
    priority: "medium",
    progressPercent: 0,
    labels: [],
    parentProjectId: undefined,
    path: [title],
    milestoneIds: [],
    milestones: [],
    taskIds: [],
    taskCount: 0,
    openTaskCount: repo.open_issues_count,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
  }
}

// ── Comment Mapping ────────────────────────────────────────────────────────

export function mapGitHubCommentToCommentRef(args: {
  workspaceConfig: WorkspaceConfig
  repoFullName: string
  issueNumber: number
  entityType: CommentRef["entityType"]
  comment: GitHubComment
}): CommentRef {
  const entityScope = args.entityType === "task" ? "tasks" : "projects"
  const entityId = createEntityId(entityScope, args.repoFullName, args.issueNumber)

  return {
    id: `comment:github:${args.repoFullName}:${args.issueNumber}:${args.comment.id}`,
    externalId: String(args.comment.id),
    threadId: `${args.repoFullName}:${args.issueNumber}`,
    entityType: args.entityType,
    entityId,
    body: args.comment.body ?? "",
    bodyFormat: "markdown",
    author: mapGitHubUser(args.comment.user),
    createdAt: args.comment.created_at,
    updatedAt:
      args.comment.updated_at !== args.comment.created_at ? args.comment.updated_at : undefined,
    edited: args.comment.updated_at !== args.comment.created_at,
    mentions: [],
  }
}

// ── People Collection ──────────────────────────────────────────────────────

export function collectPeopleFromGitHubEntities(args: {
  projects: WorkspaceProject[]
  tasks: WorkspaceTask[]
  comments: CommentRef[]
}): PersonRef[] {
  const people = new Map<string, PersonRef>()

  const addPerson = (person: PersonRef | undefined) => {
    if (person && person.id !== "unknown") {
      people.set(person.id, person)
    }
  }

  for (const project of args.projects) {
    addPerson(project.owner)
    for (const collaborator of project.collaborators) {
      addPerson(collaborator)
    }
  }

  for (const task of args.tasks) {
    addPerson(task.assignee)
    addPerson(task.reporter)
    addPerson(task.createdBy)
    addPerson(task.modifiedBy)
    for (const watcher of task.watchers) {
      addPerson(watcher)
    }
  }

  for (const comment of args.comments) {
    addPerson(comment.author)
    for (const mention of comment.mentions) {
      addPerson(mention)
    }
  }

  return Array.from(people.values())
}

// ── Task Aggregates ────────────────────────────────────────────────────────

export function applyProjectTaskAggregates(
  projects: WorkspaceProject[],
  tasks: WorkspaceTask[],
): WorkspaceProject[] {
  return projects.map((project) => {
    const projectTasks = tasks.filter((task) => task.projectId === project.id)

    return {
      ...project,
      taskIds: projectTasks.map((task) => task.id),
      taskCount: projectTasks.length,
      openTaskCount: projectTasks.filter((task) => task.status !== "done").length,
    }
  })
}

// ── Workspace Builder ──────────────────────────────────────────────────────

export function buildGitHubBackedWorkspace(args: {
  workspaceConfig: WorkspaceConfig
  projects: WorkspaceProject[]
  tasks: WorkspaceTask[]
}): PiperWorkspace {
  const config = args.workspaceConfig

  return {
    id: config.workspace.id,
    slug: config.workspace.id,
    name: config.workspace.label,
    description: config.workspace.description ?? "GitHub Issues-backed Piper workspace.",
    tenantName: config.workspace.tenant.label,
    mode: "github" as PiperWorkspace["mode"],
    sourceRefs: [
      {
        siteId: config.lists.tasks.site.id,
        listId: config.lists.tasks.list.id,
        label: config.lists.tasks.list.label,
        entityType: "task",
      },
      {
        siteId: config.lists.projects.site.id,
        listId: config.lists.projects.list.id,
        label: config.lists.projects.list.label,
        entityType: "project",
      },
    ],
    presets: config.views.map((view) => ({
      id: view.id,
      name: view.label,
      kind: view.kind as "list" | "board" | "timeline",
      description: view.description,
      default: view.isDefault,
    })),
    summary: {
      taskCount: args.tasks.length,
      projectCount: args.projects.length,
      openTaskCount: args.tasks.filter((task) => task.status !== "done").length,
      overdueTaskCount: args.tasks.filter(
        (task) =>
          task.dueDate !== undefined &&
          task.dueDate < new Date().toISOString().slice(0, 10) &&
          task.status !== "done",
      ).length,
    },
    createdAt:
      args.projects[0]?.createdAt ?? args.tasks[0]?.createdAt ?? new Date().toISOString(),
    updatedAt:
      [...args.projects.map((p) => p.updatedAt), ...args.tasks.map((t) => t.updatedAt)]
        .sort()
        .at(-1) ?? new Date().toISOString(),
  }
}
