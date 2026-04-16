/**
 * Mock Linear GraphQL API payloads for testing.
 */

import type {
  LinearIssue,
  LinearProject,
  LinearComment,
  LinearUser,
  LinearLabel,
  LinearTeam,
  LinearWorkflowState,
} from "./linear-types"

// ── Mock Users ─────────────────────────────────────────────────────────────

export const mockLinearUsers: Record<string, LinearUser> = {
  alice: {
    id: "user-alice",
    name: "Alice Chen",
    displayName: "Alice Chen",
    email: "alice@example.com",
    avatarUrl: "https://avatars.linear.app/u/alice",
    active: true,
    isBot: false,
  },
  bob: {
    id: "user-bob",
    name: "Bob Martinez",
    displayName: "Bob Martinez",
    email: "bob@example.com",
    avatarUrl: "https://avatars.linear.app/u/bob",
    active: true,
    isBot: false,
  },
  charlie: {
    id: "user-charlie",
    name: "Charlie Park",
    displayName: "Charlie Park",
    email: "charlie@example.com",
    avatarUrl: "https://avatars.linear.app/u/charlie",
    active: true,
    isBot: false,
  },
}

// ── Mock Labels ────────────────────────────────────────────────────────────

const mockLabels: LinearLabel[] = [
  { id: "label-bug", name: "Bug", color: "#d73a4a", description: "Something isn't working" },
  { id: "label-feature", name: "Feature", color: "#0075ca", description: "New feature" },
  { id: "label-infra", name: "Infrastructure", color: "#006b75", description: "Infrastructure" },
  { id: "label-docs", name: "Documentation", color: "#d4c5f9", description: "Documentation" },
  { id: "label-ux", name: "UX", color: "#fef2c0", description: "UX related" },
]

// ── Mock Team ──────────────────────────────────────────────────────────────

export const mockLinearTeam: LinearTeam = {
  id: "team-piper",
  name: "Piper",
  key: "PIPER",
  description: "Piper project management",
  icon: "🎯",
  color: "#5B6BF0",
  createdAt: "2026-03-01T00:00:00Z",
  updatedAt: "2026-03-29T15:00:00Z",
}

// ── Mock Workflow States ───────────────────────────────────────────────────

export const mockWorkflowStates: LinearWorkflowState[] = [
  { id: "state-backlog", name: "Backlog", type: "backlog", color: "#C5C5C5" },
  { id: "state-todo", name: "Todo", type: "unstarted", color: "#F2C94C" },
  { id: "state-in-progress", name: "In Progress", type: "started", color: "#F2994A" },
  { id: "state-done", name: "Done", type: "completed", color: "#6FCF97" },
  { id: "state-canceled", name: "Canceled", type: "canceled", color: "#BDBDBD" },
  { id: "state-triage", name: "Triage", type: "triage", color: "#EB5757" },
]

// ── Mock Issues ────────────────────────────────────────────────────────────

export const mockLinearIssues: LinearIssue[] = [
  {
    id: "issue-1",
    identifier: "PIPER-1",
    title: "Set up CI/CD pipeline",
    description: "Configure GitHub Actions for automated builds and deployments.",
    url: "https://linear.app/noovoleum/issue/PIPER-1",
    priority: 3, // Medium
    sortOrder: 100,
    estimate: 3,
    createdAt: "2026-03-20T10:00:00Z",
    updatedAt: "2026-03-28T15:30:00Z",
    completedAt: null,
    canceledAt: null,
    startedAt: "2026-03-21T09:00:00Z",
    dueDate: "2026-04-05",
    state: mockWorkflowStates[2]!, // In Progress
    assignee: mockLinearUsers.alice,
    creator: mockLinearUsers.bob,
    labels: { nodes: [mockLabels[2]!] }, // Infrastructure
    project: null,
    team: mockLinearTeam,
    cycle: null,
    parent: null,
    commentCount: 2,
  },
  {
    id: "issue-2",
    identifier: "PIPER-2",
    title: "Implement user authentication",
    description: "Add OAuth2 login flow with PKCE.",
    url: "https://linear.app/noovoleum/issue/PIPER-2",
    priority: 2, // High
    sortOrder: 200,
    estimate: 5,
    createdAt: "2026-03-15T08:00:00Z",
    updatedAt: "2026-03-25T12:00:00Z",
    completedAt: "2026-03-25T12:00:00Z",
    canceledAt: null,
    startedAt: "2026-03-16T10:00:00Z",
    dueDate: null,
    state: mockWorkflowStates[3]!, // Done
    assignee: mockLinearUsers.bob,
    creator: mockLinearUsers.alice,
    labels: { nodes: [mockLabels[1]!] }, // Feature
    project: null,
    team: mockLinearTeam,
    cycle: null,
    parent: null,
    commentCount: 1,
  },
  {
    id: "issue-3",
    identifier: "PIPER-3",
    title: "Write API documentation",
    description: null,
    url: "https://linear.app/noovoleum/issue/PIPER-3",
    priority: 0, // No priority
    sortOrder: 300,
    estimate: null,
    createdAt: "2026-03-22T09:00:00Z",
    updatedAt: "2026-03-22T09:00:00Z",
    completedAt: null,
    canceledAt: null,
    startedAt: null,
    dueDate: null,
    state: mockWorkflowStates[1]!, // Todo
    assignee: null,
    creator: mockLinearUsers.charlie,
    labels: { nodes: [mockLabels[3]!] }, // Documentation
    project: null,
    team: mockLinearTeam,
    cycle: null,
    parent: null,
    commentCount: 0,
  },
  {
    id: "issue-4",
    identifier: "PIPER-4",
    title: "Fix responsive layout bugs",
    description: "Several layout issues on mobile viewports need fixing.",
    url: "https://linear.app/noovoleum/issue/PIPER-4",
    priority: 1, // Urgent
    sortOrder: 400,
    estimate: 2,
    createdAt: "2026-03-24T14:00:00Z",
    updatedAt: "2026-03-29T11:00:00Z",
    completedAt: null,
    canceledAt: null,
    startedAt: null,
    dueDate: "2026-04-01",
    state: mockWorkflowStates[0]!, // Backlog
    assignee: mockLinearUsers.charlie,
    creator: mockLinearUsers.alice,
    labels: { nodes: [mockLabels[0]!, mockLabels[4]!] }, // Bug, UX
    project: null,
    team: mockLinearTeam,
    cycle: null,
    parent: null,
    commentCount: 0,
  },
]

// ── Mock Project ───────────────────────────────────────────────────────────

export const mockLinearProject: LinearProject = {
  id: "project-piper",
  name: "Piper v1",
  description: "Piper project management application",
  slugId: "piper-v1",
  icon: "🚀",
  color: "#5B6BF0",
  state: "active",
  startDate: "2026-03-01",
  targetDate: "2026-06-30",
  completedAt: null,
  canceledAt: null,
  lead: mockLinearUsers.alice,
  members: { nodes: [mockLinearUsers.alice, mockLinearUsers.bob] },
  teams: { nodes: [mockLinearTeam] },
  progress: 0.35,
  createdAt: "2026-03-01T00:00:00Z",
  updatedAt: "2026-03-29T15:00:00Z",
}

// ── Mock Comments ──────────────────────────────────────────────────────────

export const mockLinearComments: Record<string, LinearComment[]> = {
  "PIPER-1": [
    {
      id: "comment-1001",
      body: "Started working on the GitHub Actions workflow.",
      createdAt: "2026-03-21T10:00:00Z",
      updatedAt: "2026-03-21T10:00:00Z",
      user: mockLinearUsers.bob,
      issue: { id: "issue-1", identifier: "PIPER-1" },
      parent: null,
    },
    {
      id: "comment-1002",
      body: "Need to add integration tests before merging.",
      createdAt: "2026-03-22T14:00:00Z",
      updatedAt: "2026-03-22T14:30:00Z",
      user: mockLinearUsers.alice,
      issue: { id: "issue-1", identifier: "PIPER-1" },
      parent: null,
    },
  ],
  "PIPER-2": [
    {
      id: "comment-1003",
      body: "OAuth2 flow is working. Need to add refresh token handling.",
      createdAt: "2026-03-20T09:00:00Z",
      updatedAt: "2026-03-20T09:00:00Z",
      user: mockLinearUsers.alice,
      issue: { id: "issue-2", identifier: "PIPER-2" },
      parent: null,
    },
  ],
}
