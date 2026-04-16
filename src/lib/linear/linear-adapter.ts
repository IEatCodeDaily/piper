/**
 * Mapping functions: Linear GraphQL API payloads → Piper domain types.
 *
 * All mapping is config-driven: field names come from `WorkspaceListConfig.fields[].sourceField`.
 * Linear has a rich native schema with proper status, priority, and project fields,
 * so the mapping is more direct than GitHub's label-based approach.
 */

import type { CommentRef } from "@/features/comments/types"
import type { PersonRef } from "@/features/people/types"
import type { WorkspaceProject } from "@/features/projects/types"
import type { WorkspaceTask } from "@/features/tasks/types"
import type { WorkspaceConfig } from "@/features/workspaces/types"
import type { PiperWorkspace } from "@/lib/domain/workspace"
import type {
  LinearComment,
  LinearIssue,
  LinearIssuePriority,
  LinearProject,
  LinearUser,
  LinearWorkflowType,
} from "./linear-types"

// ── Entity IDs ─────────────────────────────────────────────────────────────

/**
 * Create a stable entity ID from Linear coordinates.
 * Format: linear:tasks:TEAM_KEY:IDENTIFIER or linear:projects:slugId:SLUG
 */
function createEntityId(scope: "tasks" | "projects", teamKeyOrSlug: string, identifier: string) {
  return `linear:${scope}:${teamKeyOrSlug}:${identifier}`
}

// ── Person Mapping ─────────────────────────────────────────────────────────

export function mapLinearUser(user: LinearUser | null | undefined, fallbackName = "Unknown person"): PersonRef {
  if (!user) {
    return {
      id: "unknown",
      externalId: "unknown",
      displayName: fallbackName,
      email: "unknown@linear.local",
    }
  }

  return {
    id: user.id,
    externalId: user.email ?? user.id,
    displayName: user.displayName ?? user.name,
    email: user.email ?? `${user.id}@linear.local`,
    avatarUrl: user.avatarUrl ?? undefined,
  }
}

// ── Status Mapping ─────────────────────────────────────────────────────────

/**
 * Maps Linear workflow state types to Piper status.
 *
 * Linear types: unstarted, started, completed, canceled, backlog, triage
 * Piper statuses: backlog, planned, in-progress, blocked, in-review, done
 */
function normalizeTaskStatus(workflowType: LinearWorkflowType): WorkspaceTask["status"] {
  switch (workflowType) {
    case "backlog":
      return "backlog"
    case "triage":
    case "unstarted":
      return "planned"
    case "started":
      return "in-progress"
    case "completed":
      return "done"
    case "canceled":
      return "done" // Map canceled to done with completion tracking
    default:
      return "planned"
  }
}

/**
 * Maps Linear project state to Piper project status.
 *
 * Linear: planned, active, paused, backlog, completed, canceled
 * Piper: planned, active, blocked, complete, on-hold
 */
function normalizeProjectStatus(state: LinearProject["state"]): WorkspaceProject["status"] {
  switch (state) {
    case "planned":
    case "backlog":
      return "planned"
    case "active":
      return "active"
    case "paused":
      return "on-hold"
    case "completed":
      return "complete"
    case "canceled":
      return "complete"
    default:
      return "active"
  }
}

// ── Priority Mapping ───────────────────────────────────────────────────────

function normalizeTaskPriority(priority: LinearIssuePriority): WorkspaceTask["priority"] {
  switch (priority) {
    case 1: // Urgent
      return "urgent"
    case 2: // High
      return "high"
    case 3: // Medium
      return "medium"
    case 4: // Low
    case 0: // No priority
    default:
      return "low"
  }
}

// ── Task Mapping ───────────────────────────────────────────────────────────

export function mapLinearIssueToWorkspaceTask(args: {
  workspaceConfig: WorkspaceConfig
  issue: LinearIssue
}): WorkspaceTask {
  const issue = args.issue
  const workspaceId = args.workspaceConfig.workspace.id
  const teamKey = issue.team.key

  // Status
  const status = normalizeTaskStatus(issue.state.type)

  // Priority
  const priority = normalizeTaskPriority(issue.priority)

  // Assignee
  const assignee = mapLinearUser(issue.assignee ?? null)

  // Reporter / creator
  const reporter = mapLinearUser(issue.creator ?? null)

  // Description
  const description = issue.description ?? ""

  // Dates
  const startDate = issue.startedAt ?? undefined
  const dueDate = issue.dueDate ?? undefined

  // Labels
  const labels = issue.labels.nodes.map((l) => l.name).filter(Boolean)

  // Project code from team key
  const projectCode = issue.project?.slugId
    ? `${teamKey}/${issue.project.slugId}`
    : teamKey

  // Project ID
  const projectId = issue.project
    ? createEntityId("projects", issue.project.slugId, issue.project.slugId)
    : undefined

  // Parent task
  const parentTaskId = issue.parent
    ? createEntityId("tasks", teamKey, issue.parent.identifier)
    : undefined

  // People
  const createdBy = mapLinearUser(issue.creator ?? null, "Unknown creator")
  const modifiedBy = mapLinearUser(issue.creator ?? null, "Unknown modifier")

  return {
    id: createEntityId("tasks", teamKey, issue.identifier),
    externalId: issue.identifier,
    workspaceId,
    title: issue.title,
    status,
    priority,
    description,
    assignee,
    reporter,
    watchers: [],
    projectId,
    projectCode,
    parentTaskId,
    path: [issue.title],
    labels,
    startDate,
    dueDate,
    completedAt: issue.completedAt ?? issue.canceledAt ?? undefined,
    estimatePoints: issue.estimate ?? undefined,
    remainingPoints: undefined,
    sortOrder: issue.sortOrder,
    checklist: [],
    attachments: [],
    commentIds: [],
    comments: [],
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    createdBy,
    modifiedBy,
  }
}

// ── Project Mapping ────────────────────────────────────────────────────────

export function mapLinearProjectToWorkspaceProject(args: {
  workspaceConfig: WorkspaceConfig
  project: LinearProject
}): WorkspaceProject {
  const project = args.project
  const workspaceId = args.workspaceConfig.workspace.id
  const title = project.name

  const status = normalizeProjectStatus(project.state)

  const lead = mapLinearUser(project.lead ?? null)
  const collaborators = (project.members?.nodes ?? []).map((u) => mapLinearUser(u))

  // Health from progress
  let healthStatus: "on-track" | "at-risk" | "off-track" | "done" = "on-track"
  if (status === "complete") {
    healthStatus = "done"
  } else if (project.progress < 30) {
    healthStatus = "on-track"
  } else if (project.progress < 60) {
    healthStatus = "at-risk"
  }

  return {
    id: createEntityId("projects", project.slugId, project.slugId),
    externalId: project.id,
    workspaceId,
    projectCode: project.slugId,
    title,
    description: project.description ?? "",
    status,
    health: { status: healthStatus, summary: `Linear project: ${Math.round(project.progress * 100)}% progress.` },
    owner: lead,
    collaborators,
    startDate: project.startDate ?? undefined,
    targetDate: project.targetDate ?? undefined,
    completedAt: project.completedAt ?? undefined,
    priority: "medium",
    progressPercent: Math.round(project.progress * 100),
    labels: [],
    parentProjectId: undefined,
    path: [title],
    milestoneIds: [],
    milestones: [],
    taskIds: [],
    taskCount: 0,
    openTaskCount: 0,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  }
}

// ── Comment Mapping ────────────────────────────────────────────────────────

export function mapLinearCommentToCommentRef(args: {
  workspaceConfig: WorkspaceConfig
  comment: LinearComment
  entityType: CommentRef["entityType"]
}): CommentRef {
  const comment = args.comment
  const identifier = comment.issue.identifier
  const teamKey = identifier.split("-")[0] ?? "unknown"

  const entityId = createEntityId("tasks", teamKey, identifier)

  return {
    id: `comment:linear:${identifier}:${comment.id}`,
    externalId: comment.id,
    threadId: identifier,
    parentCommentId: comment.parent?.id ?? undefined,
    entityType: args.entityType,
    entityId,
    body: comment.body ?? "",
    bodyFormat: "markdown",
    author: mapLinearUser(comment.user ?? null),
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt !== comment.createdAt ? comment.updatedAt : undefined,
    edited: comment.updatedAt !== comment.createdAt,
    mentions: [],
  }
}

// ── People Collection ──────────────────────────────────────────────────────

export function collectPeopleFromLinearEntities(args: {
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

export function buildLinearBackedWorkspace(args: {
  workspaceConfig: WorkspaceConfig
  projects: WorkspaceProject[]
  tasks: WorkspaceTask[]
}): PiperWorkspace {
  const config = args.workspaceConfig

  return {
    id: config.workspace.id,
    slug: config.workspace.id,
    name: config.workspace.label,
    description: config.workspace.description ?? "Linear-backed Piper workspace.",
    tenantName: config.workspace.tenant.label,
    mode: "linear" as PiperWorkspace["mode"],
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
