/**
 * Linear GraphQL API — TypeScript types for API responses.
 *
 * Reference: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 * GraphQL Schema: https://studio.apollographql.com/public/Linear-API/variant/current/schema
 */

// ── Users / Actors ─────────────────────────────────────────────────────────

export interface LinearUser {
  id: string
  name: string
  displayName: string
  email: string
  avatarUrl?: string | null
  active: boolean
  isBot: boolean
}

// ── Labels ─────────────────────────────────────────────────────────────────

export interface LinearLabel {
  id: string
  name: string
  color: string
  description?: string | null
  isGroup?: boolean
  parent?: LinearLabel | null
}

// ── Teams ──────────────────────────────────────────────────────────────────

export interface LinearTeam {
  id: string
  name: string
  key: string
  description?: string | null
  icon?: string | null
  color?: string | null
  createdAt: string
  updatedAt: string
}

// ── Workflow States ────────────────────────────────────────────────────────

export type LinearWorkflowType = "unstarted" | "started" | "completed" | "canceled" | "backlog" | "triage"

export interface LinearWorkflowState {
  id: string
  name: string
  type: LinearWorkflowType
  color: string
  description?: string | null
}

// ── Cycles ─────────────────────────────────────────────────────────────────

export interface LinearCycle {
  id: string
  name: string
  description?: string | null
  startsAt: string
  endsAt: string
  completedAt?: string | null
  progress: number
}

// ── Projects ───────────────────────────────────────────────────────────────

export interface LinearProject {
  id: string
  name: string
  description?: string | null
  slugId: string
  icon?: string | null
  color?: string | null
  state: "planned" | "active" | "paused" | "backlog" | "completed" | "canceled"
  startDate?: string | null
  targetDate?: string | null
  completedAt?: string | null
  canceledAt?: string | null
  lead?: LinearUser | null
  members: { nodes: LinearUser[] }
  teams: { nodes: LinearTeam[] }
  progress: number
  createdAt: string
  updatedAt: string
}

// ── Issues ─────────────────────────────────────────────────────────────────

export type LinearIssuePriority = 0 | 1 | 2 | 3 | 4

export const linearPriorityLabels: Record<LinearIssuePriority, string> = {
  0: "No priority",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
}

export interface LinearIssue {
  id: string
  identifier: string
  title: string
  description?: string | null
  url: string
  priority: LinearIssuePriority
  sortOrder: number
  estimate?: number | null
  createdAt: string
  updatedAt: string
  completedAt?: string | null
  canceledAt?: string | null
  startedAt?: string | null
  dueDate?: string | null
  // Relations
  state: LinearWorkflowState
  assignee?: LinearUser | null
  creator: LinearUser
  labels: { nodes: LinearLabel[] }
  project?: LinearProject | null
  team: LinearTeam
  cycle?: LinearCycle | null
  parent?: { id: string; identifier: string; title: string } | null
  // Counts
  commentCount: number
}

// ── Comments ───────────────────────────────────────────────────────────────

export interface LinearComment {
  id: string
  body: string
  createdAt: string
  updatedAt: string
  user?: LinearUser | null
  issue: { id: string; identifier: string }
  parent?: LinearComment | null
}

// ── Pagination ─────────────────────────────────────────────────────────────

export interface LinearPaginationInfo {
  hasNextPage: boolean
  endCursor: string | null
}

export interface LinearConnection<T> {
  nodes: T[]
  pageInfo: LinearPaginationInfo
}

// ── GraphQL Responses ──────────────────────────────────────────────────────

export interface LinearViewerResponse {
  viewer: LinearUser & {
    teams: LinearConnection<LinearTeam>
  }
}

export interface LinearTeamsResponse {
  teams: LinearConnection<LinearTeam>
}

export interface LinearIssuesResponse {
  issues: LinearConnection<LinearIssue>
}

export interface LinearProjectsResponse {
  projects: LinearConnection<LinearProject>
}

export interface LinearCommentsResponse {
  comments: LinearConnection<LinearComment>
}

export interface LinearWorkflowStatesResponse {
  workflowStates: LinearConnection<LinearWorkflowState>
}

// ── Create / Update Inputs ─────────────────────────────────────────────────

export interface LinearCreateIssueInput {
  title: string
  description?: string
  teamId: string
  priority?: LinearIssuePriority
  projectId?: string
  assigneeId?: string
  labelIds?: string[]
  dueDate?: string
  estimate?: number
}

export interface LinearUpdateIssueInput {
  title?: string
  description?: string
  priority?: LinearIssuePriority
  projectId?: string | null
  assigneeId?: string | null
  labelIds?: string[]
  dueDate?: string | null
  stateId?: string
  estimate?: number | null
}
