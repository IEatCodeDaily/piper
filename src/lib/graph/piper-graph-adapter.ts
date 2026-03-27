import type { CommentRef } from "@/features/comments/types"
import type { PersonRef } from "@/features/people/types"
import type { WorkspaceProject, ProjectHealth, ProjectMilestone } from "@/features/projects/types"
import type { TaskAttachment, TaskChecklistItem, WorkspaceTask } from "@/features/tasks/types"
import type { WorkspaceConfig, WorkspaceEntityScope, WorkspaceListConfig } from "@/features/workspaces/types"
import type { PiperWorkspace } from "@/lib/domain/workspace"
import type {
  GraphFieldLookupValue,
  GraphFieldPersonValue,
  GraphIdentitySet,
  GraphListFieldPrimitive,
  GraphListFieldValue,
  GraphListItem,
  GraphListItemComment,
} from "@/lib/graph/types"

function createEntityId(scope: WorkspaceEntityScope, listId: string, itemId: string) {
  return `${scope}:${listId}:${itemId}`
}

function parseJsonArray<TValue>(value: GraphListFieldValue | undefined, fallback: TValue[] = []) {
  if (typeof value !== "string") {
    return fallback
  }

  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? (parsed as TValue[]) : fallback
  } catch {
    return fallback
  }
}

function isPersonValue(value: GraphListFieldValue | undefined): value is GraphFieldPersonValue {
  return value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value) && ("Email" in value || "LookupValue" in value)
}

function isLookupValue(value: GraphListFieldValue | undefined): value is GraphFieldLookupValue {
  return value !== null && value !== undefined && typeof value === "object" && !Array.isArray(value) && "LookupId" in value && !("Email" in value)
}

function asPrimitiveString(value: GraphListFieldValue | undefined) {
  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return undefined
}

function asPrimitiveNumber(value: GraphListFieldValue | undefined) {
  if (typeof value === "number") {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }

  return undefined
}

function asStringArray(value: GraphListFieldValue | undefined) {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string")
  }

  if (typeof value === "string") {
    return value
      .split(/[;,]/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  }

  return []
}

function mapIdentityToPerson(identitySet: GraphIdentitySet | undefined, fallbackName = "Unknown person"): PersonRef {
  const identity = identitySet?.user ?? identitySet?.application ?? identitySet?.device
  const displayName = identity?.displayName ?? fallbackName
  const email = identity?.email ?? identity?.userPrincipalName ?? `${displayName.toLowerCase().replace(/\s+/g, ".")}@unknown.local`

  return {
    id: identity?.id ?? email,
    externalId: identity?.id ?? email,
    displayName,
    email,
  }
}

function mapGraphPersonValue(value: GraphFieldPersonValue | undefined, fallback?: PersonRef): PersonRef | undefined {
  if (!value) {
    return fallback
  }

  const displayName = value.DisplayName ?? value.LookupValue
  const email = value.Email

  if (!displayName || !email) {
    return fallback
  }

  return {
    id: value.Email ?? String(value.LookupId ?? displayName),
    externalId: String(value.LookupId ?? value.Email ?? displayName),
    displayName,
    email,
    jobTitle: value.JobTitle,
    department: value.Department,
  }
}

function mapGraphPersonArray(value: GraphListFieldValue | undefined) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((entry): entry is GraphFieldPersonValue => isPersonValue(entry))
    .map((entry) => mapGraphPersonValue(entry))
    .filter((entry): entry is PersonRef => entry !== undefined)
}

function mapLookupId(value: GraphListFieldValue | undefined, targetListId: string, scope: WorkspaceEntityScope) {
  if (!isLookupValue(value)) {
    return undefined
  }

  return createEntityId(scope, targetListId, String(value.LookupId))
}

function parsePath(value: GraphListFieldPrimitive | undefined, fallback: string[]) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback
  }

  return value
    .split(">")
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function normalizeTaskStatus(value: string | undefined): WorkspaceTask["status"] {
  switch (value?.trim().toLowerCase()) {
    case "not started":
    case "planned":
      return "planned"
    case "in progress":
      return "in-progress"
    case "blocked":
      return "blocked"
    case "in review":
      return "in-review"
    case "done":
    case "completed":
      return "done"
    case "backlog":
      return "backlog"
    default:
      return "backlog"
  }
}

function normalizeTaskPriority(value: string | undefined): WorkspaceTask["priority"] {
  switch (value?.trim().toLowerCase()) {
    case "urgent":
      return "urgent"
    case "high":
      return "high"
    case "medium":
      return "medium"
    default:
      return "low"
  }
}

function normalizeProjectStatus(value: string | undefined): WorkspaceProject["status"] {
  switch (value?.trim().toLowerCase()) {
    case "active":
      return "active"
    case "blocked":
      return "blocked"
    case "done":
    case "complete":
      return "complete"
    case "on hold":
    case "on-hold":
      return "on-hold"
    default:
      return "planned"
  }
}

function normalizeProjectPriority(value: string | undefined): WorkspaceProject["priority"] {
  switch (value?.trim().toLowerCase()) {
    case "urgent":
      return "urgent"
    case "high":
      return "high"
    case "medium":
      return "medium"
    default:
      return "low"
  }
}

function normalizeProjectHealth(value: string | undefined, summary: string): ProjectHealth {
  switch (value?.trim().toLowerCase()) {
    case "done":
      return { status: "done", summary }
    case "on track":
    case "on-track":
      return { status: "on-track", summary }
    case "at risk":
    case "at-risk":
      return { status: "at-risk", summary }
    default:
      return { status: "off-track", summary }
  }
}

function getSourceField(listConfig: WorkspaceListConfig, semanticField: string) {
  return listConfig.fields[semanticField]?.sourceField
}

function getFieldValue(item: GraphListItem, listConfig: WorkspaceListConfig, semanticField: string) {
  const sourceField = getSourceField(listConfig, semanticField)
  return sourceField ? item.fields[sourceField] : undefined
}

function mapMilestones(item: GraphListItem): ProjectMilestone[] {
  return parseJsonArray<ProjectMilestone>(item.fields.MilestoneData)
}

function mapChecklist(item: GraphListItem): TaskChecklistItem[] {
  return parseJsonArray<TaskChecklistItem>(item.fields.ChecklistData)
}

function mapAttachments(item: GraphListItem): TaskAttachment[] {
  return parseJsonArray<TaskAttachment>(item.fields.AttachmentLinks)
}

export function mapGraphListCommentToCommentRef(args: {
  workspaceConfig: WorkspaceConfig
  listId: string
  itemId: string
  entityType: CommentRef["entityType"]
  graphComment: GraphListItemComment
}): CommentRef {
  const entityScope = args.entityType === "task" ? "tasks" : "projects"

  return {
    id: `comment:${args.listId}:${args.itemId}:${args.graphComment.id}`,
    externalId: args.graphComment.id,
    threadId: `${args.listId}:${args.itemId}`,
    entityType: args.entityType,
    entityId: createEntityId(entityScope, args.listId, args.itemId),
    body: args.graphComment.content,
    bodyFormat: args.graphComment.contentType === "html" ? "html" : "plain-text",
    author: mapIdentityToPerson(args.graphComment.createdBy),
    createdAt: args.graphComment.createdDateTime,
    updatedAt: args.graphComment.lastModifiedDateTime,
    edited:
      args.graphComment.lastModifiedDateTime !== undefined &&
      args.graphComment.lastModifiedDateTime !== args.graphComment.createdDateTime,
    mentions:
      args.graphComment.mentions?.map((mention) => mapIdentityToPerson(mention.mentioned, mention.mentionText.replace(/^@/, ""))) ?? [],
  }
}

export function mapGraphListItemToWorkspaceProject(args: {
  workspaceConfig: WorkspaceConfig
  item: GraphListItem
}): WorkspaceProject {
  const listConfig = args.workspaceConfig.lists.projects
  const owner =
    mapGraphPersonValue(getFieldValue(args.item, listConfig, "owner") as GraphFieldPersonValue | undefined) ??
    mapIdentityToPerson(args.item.createdBy)
  const title = asPrimitiveString(getFieldValue(args.item, listConfig, "title")) ?? "Untitled project"
  const healthSummary = asPrimitiveString(args.item.fields.ProjectHealthSummary) ?? "No project health summary has been captured yet."

  return {
    id: createEntityId("projects", listConfig.list.id, args.item.id),
    externalId: asPrimitiveString(getFieldValue(args.item, listConfig, "projectCode")) ?? args.item.id,
    workspaceId: args.workspaceConfig.workspace.id,
    projectCode: asPrimitiveString(getFieldValue(args.item, listConfig, "projectCode")) ?? args.item.id,
    title,
    description: asPrimitiveString(getFieldValue(args.item, listConfig, "description")) ?? "",
    status: normalizeProjectStatus(asPrimitiveString(getFieldValue(args.item, listConfig, "status"))),
    health: normalizeProjectHealth(asPrimitiveString(args.item.fields.ProjectHealth), healthSummary),
    owner,
    collaborators: mapGraphPersonArray(args.item.fields.Collaborators),
    startDate: asPrimitiveString(getFieldValue(args.item, listConfig, "startDate")),
    targetDate: asPrimitiveString(getFieldValue(args.item, listConfig, "dueDate")),
    completedAt: undefined,
    priority: normalizeProjectPriority(asPrimitiveString(args.item.fields.ProjectPriority)),
    progressPercent: asPrimitiveNumber(args.item.fields.ProgressPercent) ?? 0,
    labels: asStringArray(args.item.fields.Tags),
    parentProjectId: mapLookupId(getFieldValue(args.item, listConfig, "parentProjectRef"), listConfig.list.id, "projects"),
    path: parsePath(args.item.fields.PiperPath as GraphListFieldPrimitive | undefined, [title]),
    milestoneIds: mapMilestones(args.item).map((milestone) => milestone.id),
    milestones: mapMilestones(args.item),
    taskIds: [],
    taskCount: asPrimitiveNumber(args.item.fields.TaskCount) ?? 0,
    openTaskCount: asPrimitiveNumber(args.item.fields.OpenTaskCount) ?? 0,
    createdAt: args.item.createdDateTime,
    updatedAt: args.item.lastModifiedDateTime,
  }
}

export function mapGraphListItemToWorkspaceTask(args: {
  workspaceConfig: WorkspaceConfig
  item: GraphListItem
}): WorkspaceTask {
  const taskListConfig = args.workspaceConfig.lists.tasks
  const projectListId = args.workspaceConfig.lists.projects.list.id
  const title = asPrimitiveString(getFieldValue(args.item, taskListConfig, "title")) ?? "Untitled task"
  const createdBy = mapIdentityToPerson(args.item.createdBy)
  const modifiedBy = mapIdentityToPerson(args.item.lastModifiedBy)

  return {
    id: createEntityId("tasks", taskListConfig.list.id, args.item.id),
    externalId: asPrimitiveString(args.item.fields.TaskKey) ?? args.item.id,
    workspaceId: args.workspaceConfig.workspace.id,
    title,
    status: normalizeTaskStatus(asPrimitiveString(getFieldValue(args.item, taskListConfig, "status"))),
    priority: normalizeTaskPriority(asPrimitiveString(getFieldValue(args.item, taskListConfig, "priority"))),
    description: asPrimitiveString(getFieldValue(args.item, taskListConfig, "description")) ?? "",
    assignee: mapGraphPersonValue(getFieldValue(args.item, taskListConfig, "assignee") as GraphFieldPersonValue | undefined),
    reporter: mapGraphPersonValue(args.item.fields.Reporter as GraphFieldPersonValue | undefined, createdBy),
    watchers: mapGraphPersonArray(args.item.fields.Watchers),
    projectId: mapLookupId(getFieldValue(args.item, taskListConfig, "projectRef"), projectListId, "projects"),
    projectCode: isLookupValue(getFieldValue(args.item, taskListConfig, "projectRef"))
      ? (getFieldValue(args.item, taskListConfig, "projectRef") as GraphFieldLookupValue).LookupValue
      : undefined,
    parentTaskId: mapLookupId(getFieldValue(args.item, taskListConfig, "parentTaskRef"), taskListConfig.list.id, "tasks"),
    path: parsePath(args.item.fields.PiperPath as GraphListFieldPrimitive | undefined, [title]),
    labels: asStringArray(getFieldValue(args.item, taskListConfig, "labels")),
    startDate: asPrimitiveString(getFieldValue(args.item, taskListConfig, "startDate")),
    dueDate: asPrimitiveString(getFieldValue(args.item, taskListConfig, "dueDate")),
    completedAt: asPrimitiveString(args.item.fields.CompletedAt),
    estimatePoints: asPrimitiveNumber(args.item.fields.EstimatePoints),
    remainingPoints: asPrimitiveNumber(args.item.fields.RemainingPoints),
    sortOrder: asPrimitiveNumber(args.item.fields.SortOrder) ?? 0,
    checklist: mapChecklist(args.item),
    attachments: mapAttachments(args.item),
    commentIds: [],
    comments: [],
    createdAt: args.item.createdDateTime,
    updatedAt: args.item.lastModifiedDateTime,
    createdBy,
    modifiedBy,
  }
}

export function attachCommentsToTasks(tasks: WorkspaceTask[], comments: CommentRef[]) {
  const commentsByEntityId = new Map<string, CommentRef[]>()

  for (const comment of comments) {
    const current = commentsByEntityId.get(comment.entityId) ?? []
    current.push(comment)
    commentsByEntityId.set(comment.entityId, current)
  }

  return tasks.map((task) => {
    const taskComments = commentsByEntityId.get(task.id) ?? []
    return {
      ...task,
      commentIds: taskComments.map((comment) => comment.id),
      comments: taskComments,
    }
  })
}

export function applyProjectTaskAggregates(projects: WorkspaceProject[], tasks: WorkspaceTask[]) {
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

export function collectPeopleFromGraphEntities(args: {
  projects: WorkspaceProject[]
  tasks: WorkspaceTask[]
  comments: CommentRef[]
}) {
  const people = new Map<string, PersonRef>()

  const addPerson = (person: PersonRef | undefined) => {
    if (!person) {
      return
    }

    people.set(person.id, person)
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

export function buildGraphBackedWorkspace(args: {
  workspaceConfig: WorkspaceConfig
  projects: WorkspaceProject[]
  tasks: WorkspaceTask[]
}): PiperWorkspace {
  return {
    id: args.workspaceConfig.workspace.id,
    slug: args.workspaceConfig.workspace.id,
    name: args.workspaceConfig.workspace.label,
    description: args.workspaceConfig.workspace.description ?? "Microsoft Graph-backed Piper workspace.",
    tenantName: args.workspaceConfig.workspace.tenant.label,
    mode: "graph",
    sourceRefs: [
      {
        siteId: args.workspaceConfig.lists.tasks.site.id,
        listId: args.workspaceConfig.lists.tasks.list.id,
        label: args.workspaceConfig.lists.tasks.list.label,
        entityType: "task",
      },
      {
        siteId: args.workspaceConfig.lists.projects.site.id,
        listId: args.workspaceConfig.lists.projects.list.id,
        label: args.workspaceConfig.lists.projects.list.label,
        entityType: "project",
      },
    ],
    presets: args.workspaceConfig.views.map((view) => ({
      id: view.id,
      name: view.label,
      kind: view.kind,
      description: view.description,
      default: view.isDefault,
    })),
    summary: {
      taskCount: args.tasks.length,
      projectCount: args.projects.length,
      openTaskCount: args.tasks.filter((task) => task.status !== "done").length,
      overdueTaskCount: args.tasks.filter((task) => task.dueDate !== undefined && task.dueDate < "2026-03-27" && task.status !== "done").length,
    },
    createdAt: args.projects[0]?.createdAt ?? args.tasks[0]?.createdAt ?? new Date().toISOString(),
    updatedAt:
      [...args.projects.map((project) => project.updatedAt), ...args.tasks.map((task) => task.updatedAt)]
        .sort()
        .at(-1) ?? new Date().toISOString(),
  }
}
