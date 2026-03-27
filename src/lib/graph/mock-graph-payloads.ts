import { commentFixtures } from "@/features/comments/fixtures/comments"
import { projectFixtures } from "@/features/projects/fixtures/projects"
import { taskFixtures } from "@/features/tasks/fixtures/tasks"
import { coreOpsWorkspaceFixture } from "@/features/workspaces/fixtures"
import type {
  GraphColumnDataType,
  GraphCollectionResponse,
  GraphFieldLookupValue,
  GraphFieldPersonValue,
  GraphIdentitySet,
  GraphListColumnDefinition,
  GraphListItem,
  GraphListItemComment,
} from "@/lib/graph/types"

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function toGraphIdentity(displayName: string, email: string, id: string): GraphIdentitySet {
  return {
    user: {
      id,
      displayName,
      email,
      userPrincipalName: email,
    },
  }
}

function toPersonField(person: {
  displayName: string
  email: string
  externalId: string
  department?: string
  jobTitle?: string
}): GraphFieldPersonValue {
  return {
    LookupId: Number.parseInt(person.externalId.replace(/\D+/g, ""), 10) || undefined,
    LookupValue: person.displayName,
    DisplayName: person.displayName,
    Email: person.email,
    Claims: `i:0#.f|membership|${person.email}`,
    Department: person.department,
    JobTitle: person.jobTitle,
  }
}

function toLookupField(id: number, value: string): GraphFieldLookupValue {
  return {
    LookupId: id,
    LookupValue: value,
  }
}

const projectNumericIds = new Map(projectFixtures.map((project, index) => [project.id, 100 + index + 1]))
const taskNumericIds = new Map(taskFixtures.map((task, index) => [task.id, 300 + index + 1]))

function createProjectPath(projectTitle: string, parentTitle?: string) {
  return parentTitle ? `${parentTitle} > ${projectTitle}` : projectTitle
}

function createTaskPath(projectTitle: string | undefined, taskTitle: string) {
  return projectTitle ? `${projectTitle} > ${taskTitle}` : taskTitle
}

export const mockGraphProjectItems: GraphListItem[] = projectFixtures.map((project) => {
  const itemId = String(projectNumericIds.get(project.id))
  const parentProject = project.parentProjectId
    ? projectFixtures.find((candidate) => candidate.id === project.parentProjectId)
    : undefined

  return {
    id: itemId,
    etag: `"${itemId},4"`,
    webUrl: `${coreOpsWorkspaceFixture.lists.projects.site.webUrl}/Lists/${coreOpsWorkspaceFixture.lists.projects.list.label}/DispForm.aspx?ID=${itemId}`,
    createdDateTime: project.createdAt,
    lastModifiedDateTime: project.updatedAt,
    createdBy: toGraphIdentity(project.owner.displayName, project.owner.email, project.owner.externalId),
    lastModifiedBy: toGraphIdentity(project.owner.displayName, project.owner.email, project.owner.externalId),
    sharepointIds: {
      listId: coreOpsWorkspaceFixture.lists.projects.list.id,
      listItemId: itemId,
      listItemUniqueId: `project-${itemId}`,
      siteId: coreOpsWorkspaceFixture.lists.projects.site.id,
    },
    fields: {
      ID: Number(itemId),
      ProjectCode: project.projectCode,
      Title: project.title,
      ProjectStatus: project.status === "complete" ? "Done" : project.status === "on-hold" ? "On Hold" : project.status[0].toUpperCase() + project.status.slice(1),
      ProjectOwner: toPersonField(project.owner),
      StartDate: project.startDate ?? null,
      TargetDate: project.targetDate ?? null,
      ProjectSummary: project.description,
      ParentProject: parentProject ? toLookupField(projectNumericIds.get(parentProject.id) ?? 0, parentProject.title) : null,
      ProjectHealth: project.health.status === "done" ? "Done" : project.health.status === "on-track" ? "On Track" : project.health.status === "at-risk" ? "At Risk" : "Off Track",
      ProjectHealthSummary: project.health.summary,
      Collaborators: project.collaborators.map(toPersonField),
      ProjectPriority: project.priority[0].toUpperCase() + project.priority.slice(1),
      ProgressPercent: project.progressPercent,
      Tags: project.labels,
      MilestoneData: JSON.stringify(project.milestones),
      PiperPath: createProjectPath(project.title, parentProject?.title),
      TaskCount: project.taskCount,
      OpenTaskCount: project.openTaskCount,
    },
  }
})

export const mockGraphTaskItems: GraphListItem[] = taskFixtures.map((task) => {
  const itemId = String(taskNumericIds.get(task.id))
  const project = task.projectId ? projectFixtures.find((candidate) => candidate.id === task.projectId) : undefined
  const parentTask = task.parentTaskId ? taskFixtures.find((candidate) => candidate.id === task.parentTaskId) : undefined

  return {
    id: itemId,
    etag: `"${itemId},7"`,
    webUrl: `${coreOpsWorkspaceFixture.lists.tasks.site.webUrl}/Lists/${coreOpsWorkspaceFixture.lists.tasks.list.label}/DispForm.aspx?ID=${itemId}`,
    createdDateTime: task.createdAt,
    lastModifiedDateTime: task.updatedAt,
    createdBy: toGraphIdentity(task.createdBy.displayName, task.createdBy.email, task.createdBy.externalId),
    lastModifiedBy: toGraphIdentity(task.modifiedBy.displayName, task.modifiedBy.email, task.modifiedBy.externalId),
    sharepointIds: {
      listId: coreOpsWorkspaceFixture.lists.tasks.list.id,
      listItemId: itemId,
      listItemUniqueId: `task-${itemId}`,
      siteId: coreOpsWorkspaceFixture.lists.tasks.site.id,
    },
    fields: {
      ID: Number(itemId),
      TaskKey: task.externalId,
      Title: task.title,
      TaskStatus:
        task.status === "planned"
          ? "Not Started"
          : task.status === "in-progress"
            ? "In Progress"
            : task.status === "in-review"
              ? "In Review"
              : task.status[0].toUpperCase() + task.status.slice(1),
      Priority: task.priority[0].toUpperCase() + task.priority.slice(1),
      AssignedTo: task.assignee ? toPersonField(task.assignee) : null,
      TaskDetails: task.description,
      Project: project ? toLookupField(projectNumericIds.get(project.id) ?? 0, project.title) : null,
      ParentTask: parentTask ? toLookupField(taskNumericIds.get(parentTask.id) ?? 0, parentTask.title) : null,
      Predecessors: [],
      StartDate: task.startDate ?? null,
      DueDate: task.dueDate ?? null,
      Tags: task.labels,
      Reporter: task.reporter ? toPersonField(task.reporter) : null,
      Watchers: task.watchers.map(toPersonField),
      EstimatePoints: task.estimatePoints ?? null,
      RemainingPoints: task.remainingPoints ?? null,
      SortOrder: task.sortOrder,
      CompletedAt: task.completedAt ?? null,
      ChecklistData: JSON.stringify(task.checklist),
      AttachmentLinks: JSON.stringify(task.attachments),
      PiperPath: createTaskPath(project?.title, task.title),
    },
  }
})

const taskIdBySemanticId = new Map(taskFixtures.map((task) => [task.id, String(taskNumericIds.get(task.id))]))
const projectIdBySemanticId = new Map(projectFixtures.map((project) => [project.id, String(projectNumericIds.get(project.id))]))

function guessMentionText(content: string, displayName: string) {
  if (content.includes(`@${displayName}`)) {
    return `@${displayName}`
  }

  const firstName = displayName.split(" ")[0]
  return content.includes(`@${firstName}`) ? `@${firstName}` : `@${displayName}`
}

export const mockGraphCommentsByItemId: Record<string, GraphListItemComment[]> = commentFixtures.reduce<Record<string, GraphListItemComment[]>>((accumulator, comment) => {
  const sourceItemId =
    comment.entityType === "task" ? taskIdBySemanticId.get(comment.entityId) : projectIdBySemanticId.get(comment.entityId)

  if (!sourceItemId) {
    return accumulator
  }

  const entry = accumulator[sourceItemId] ?? []
  entry.push({
    id: comment.externalId,
    createdDateTime: comment.createdAt,
    lastModifiedDateTime: comment.updatedAt,
    content: comment.body,
    contentType: comment.bodyFormat === "html" ? "html" : "text",
    createdBy: toGraphIdentity(comment.author.displayName, comment.author.email, comment.author.externalId),
    mentions: comment.mentions.map((person, index) => ({
      id: `${comment.externalId}-mention-${index + 1}`,
      mentionText: guessMentionText(comment.body, person.displayName),
      mentioned: toGraphIdentity(person.displayName, person.email, person.externalId),
    })),
  })
  accumulator[sourceItemId] = entry
  return accumulator
}, {})

export const mockGraphProjectCollection: GraphCollectionResponse<GraphListItem> = {
  value: mockGraphProjectItems,
}

export const mockGraphTaskCollection: GraphCollectionResponse<GraphListItem> = {
  value: mockGraphTaskItems,
}

export const mockGraphCommentCollectionsByItemId: Record<string, GraphCollectionResponse<GraphListItemComment>> = Object.fromEntries(
  Object.entries(mockGraphCommentsByItemId).map(([itemId, comments]) => [itemId, { value: comments }]),
)

export const mockGraphWorkspaceBindings = [
  {
    config: coreOpsWorkspaceFixture,
    active: true,
  },
] as const

export function cloneGraphListItem(item: GraphListItem): GraphListItem {
  return {
    ...item,
    createdBy: structuredClone(item.createdBy),
    lastModifiedBy: structuredClone(item.lastModifiedBy),
    sharepointIds: item.sharepointIds ? { ...item.sharepointIds } : undefined,
    fields: structuredClone(item.fields),
  }
}

export function cloneGraphComment(comment: GraphListItemComment): GraphListItemComment {
  return {
    ...comment,
    createdBy: structuredClone(comment.createdBy),
    mentions: comment.mentions?.map((mention) => ({
      ...mention,
      mentioned: structuredClone(mention.mentioned),
    })),
  }
}

export function cloneGraphCollection<TValue>(collection: GraphCollectionResponse<TValue>): GraphCollectionResponse<TValue> {
  return {
    value: structuredClone(collection.value),
    nextLink: collection.nextLink,
  }
}

export const mockGraphListKeyByScope = {
  projects: `${coreOpsWorkspaceFixture.lists.projects.site.id}::${coreOpsWorkspaceFixture.lists.projects.list.id}`,
  tasks: `${coreOpsWorkspaceFixture.lists.tasks.site.id}::${coreOpsWorkspaceFixture.lists.tasks.list.id}`,
} as const

export const mockGraphDisplayNames = {
  projects: coreOpsWorkspaceFixture.lists.projects.list.label,
  tasks: coreOpsWorkspaceFixture.lists.tasks.list.label,
  workspace: coreOpsWorkspaceFixture.workspace.label,
  workspaceSlug: slugify(coreOpsWorkspaceFixture.workspace.label),
} as const


function toColumnDataType(dataType: string): GraphColumnDataType {
  switch (dataType) {
    case "string":
      return "text"
    case "text":
    case "markdown":
      return "note"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
    case "date":
    case "datetime":
      return "dateTime"
    case "person":
      return "person"
    case "person-multi":
      return "personMulti"
    case "choice":
      return "choice"
    case "choice-multi":
    case "labels":
      return "choiceMulti"
    case "lookup":
      return "lookup"
    case "lookup-multi":
      return "lookupMulti"
    case "url":
      return "url"
    default:
      return "unknown"
  }
}

function buildColumns(fields: Record<string, { sourceField: string; dataType: string; required?: boolean; editable?: boolean }>): GraphListColumnDefinition[] {
  return Object.entries(fields).map(([semanticField, field], index) => ({
    id: `${field.sourceField}-${index + 1}`,
    name: field.sourceField,
    displayName: semanticField,
    dataType: toColumnDataType(field.dataType),
    required: field.required ?? false,
    readOnly: field.editable === false,
    multiValue: field.dataType.endsWith("-multi") || field.dataType === "labels",
    hidden: false,
  }))
}

export const mockGraphListColumnsByScope = {
  projects: buildColumns(coreOpsWorkspaceFixture.lists.projects.fields),
  tasks: buildColumns(coreOpsWorkspaceFixture.lists.tasks.fields),
} as const

export function cloneGraphListColumn(column: GraphListColumnDefinition): GraphListColumnDefinition {
  return { ...column }
}
