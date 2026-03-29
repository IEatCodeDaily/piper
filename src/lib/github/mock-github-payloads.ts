/**
 * Mock GitHub Issues API payloads for testing.
 */

import type {
  GitHubIssue,
  GitHubRepository,
  GitHubComment,
  GitHubUser,
  GitHubLabel,
} from "./github-types"

// ── Mock Users ─────────────────────────────────────────────────────────────

export const mockGitHubUsers: Record<string, GitHubUser> = {
  alice: {
    id: 101,
    login: "alicechen",
    name: "Alice Chen",
    email: "alice@example.com",
    avatar_url: "https://avatars.githubusercontent.com/u/101",
    html_url: "https://github.com/alicechen",
    type: "User",
  },
  bob: {
    id: 102,
    login: "bobmartinez",
    name: "Bob Martinez",
    email: "bob@example.com",
    avatar_url: "https://avatars.githubusercontent.com/u/102",
    html_url: "https://github.com/bobmartinez",
    type: "User",
  },
  charlie: {
    id: 103,
    login: "charliepark",
    name: "Charlie Park",
    email: "charlie@example.com",
    avatar_url: "https://avatars.githubusercontent.com/u/103",
    html_url: "https://github.com/charliepark",
    type: "User",
  },
}

// ── Mock Labels ────────────────────────────────────────────────────────────

const mockLabels: GitHubLabel[] = [
  { id: 1, name: "bug", color: "d73a4a", description: "Something isn't working", default: true },
  { id: 2, name: "feature", color: "0075ca", description: "New feature", default: true },
  { id: 3, name: "in-progress", color: "ededed", description: "Work in progress", default: false },
  { id: 4, name: "blocked", color: "b60205", description: "Blocked on something", default: false },
  { id: 5, name: "high-priority", color: "e99695", description: "High priority", default: false },
  { id: 6, name: "devops", color: "006b75", description: "DevOps related", default: false },
  { id: 7, name: "automation", color: "c5def5", description: "Automation", default: false },
  { id: 8, name: "docs", color: "d4c5f9", description: "Documentation", default: true },
  { id: 9, name: "ui", color: "fef2c0", description: "UI related", default: false },
]

// ── Mock Issues ────────────────────────────────────────────────────────────

export const mockGitHubIssues: GitHubIssue[] = [
  {
    id: 10001,
    number: 1,
    title: "Set up CI/CD pipeline",
    body: "Configure GitHub Actions for automated builds and deployments.",
    state: "open",
    html_url: "https://github.com/noovoleum/piper/issues/1",
    user: mockGitHubUsers.bob,
    assignee: mockGitHubUsers.alice,
    assignees: [mockGitHubUsers.alice],
    labels: [mockLabels[5]!, mockLabels[6]!], // devops, automation
    milestone: null,
    created_at: "2026-03-20T10:00:00Z",
    updated_at: "2026-03-28T15:30:00Z",
    closed_at: null,
    locked: false,
    comments: 2,
    repository_url: "https://api.github.com/repos/noovoleum/piper",
  },
  {
    id: 10002,
    number: 2,
    title: "Implement user authentication",
    body: "Add OAuth2 login flow with PKCE.",
    state: "closed",
    html_url: "https://github.com/noovoleum/piper/issues/2",
    user: mockGitHubUsers.alice,
    assignee: mockGitHubUsers.bob,
    assignees: [mockGitHubUsers.bob],
    labels: [mockLabels[4]!], // high-priority
    milestone: null,
    created_at: "2026-03-15T08:00:00Z",
    updated_at: "2026-03-25T12:00:00Z",
    closed_at: "2026-03-25T12:00:00Z",
    locked: false,
    comments: 1,
    repository_url: "https://api.github.com/repos/noovoleum/piper",
  },
  {
    id: 10003,
    number: 3,
    title: "Write API documentation",
    body: null,
    state: "open",
    html_url: "https://github.com/noovoleum/piper/issues/3",
    user: mockGitHubUsers.charlie,
    assignee: null,
    assignees: [],
    labels: [mockLabels[8]!], // docs
    milestone: null,
    created_at: "2026-03-22T09:00:00Z",
    updated_at: "2026-03-22T09:00:00Z",
    closed_at: null,
    locked: false,
    comments: 0,
    repository_url: "https://api.github.com/repos/noovoleum/piper",
  },
  {
    id: 10004,
    number: 4,
    title: "Fix responsive layout bugs",
    body: "Several layout issues on mobile viewports need fixing.",
    state: "open",
    html_url: "https://github.com/noovoleum/piper/issues/4",
    user: mockGitHubUsers.alice,
    assignee: mockGitHubUsers.charlie,
    assignees: [mockGitHubUsers.charlie],
    labels: [mockLabels[0]!, mockLabels[8]!, mockLabels[3]!], // bug, ui, blocked
    milestone: null,
    created_at: "2026-03-24T14:00:00Z",
    updated_at: "2026-03-29T11:00:00Z",
    closed_at: null,
    locked: false,
    comments: 0,
    repository_url: "https://api.github.com/repos/noovoleum/piper",
  },
  // A pull request (should be filtered out)
  {
    id: 10005,
    number: 5,
    title: "Add README.md",
    body: "Initial README for the project.",
    state: "open",
    html_url: "https://github.com/noovoleum/piper/pull/5",
    user: mockGitHubUsers.alice,
    assignee: mockGitHubUsers.alice,
    assignees: [mockGitHubUsers.alice],
    labels: [],
    milestone: null,
    created_at: "2026-03-25T10:00:00Z",
    updated_at: "2026-03-25T10:00:00Z",
    closed_at: null,
    locked: false,
    comments: 0,
    pull_request: {
      url: "https://api.github.com/repos/noovoleum/piper/pulls/5",
      html_url: "https://github.com/noovoleum/piper/pull/5",
    },
    repository_url: "https://api.github.com/repos/noovoleum/piper",
  },
]

// ── Mock Repository ────────────────────────────────────────────────────────

export const mockGitHubRepo: GitHubRepository = {
  id: 20001,
  name: "piper",
  full_name: "noovoleum/piper",
  owner: mockGitHubUsers.alice,
  html_url: "https://github.com/noovoleum/piper",
  description: "Piper project management application",
  private: false,
  open_issues_count: 3,
  language: "TypeScript",
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-29T15:00:00Z",
}

// ── Mock Comments ──────────────────────────────────────────────────────────

export const mockGitHubComments: Record<number, GitHubComment[]> = {
  1: [
    {
      id: 1001,
      body: "Started working on the GitHub Actions workflow.",
      user: mockGitHubUsers.bob,
      created_at: "2026-03-21T10:00:00Z",
      updated_at: "2026-03-21T10:00:00Z",
      html_url: "https://github.com/noovoleum/piper/issues/1#issuecomment-1001",
      issue_url: "https://api.github.com/repos/noovoleum/piper/issues/1",
    },
    {
      id: 1002,
      body: "Need to add integration tests before merging.",
      user: mockGitHubUsers.alice,
      created_at: "2026-03-22T14:00:00Z",
      updated_at: "2026-03-22T14:30:00Z",
      html_url: "https://github.com/noovoleum/piper/issues/1#issuecomment-1002",
      issue_url: "https://api.github.com/repos/noovoleum/piper/issues/1",
    },
  ],
  2: [
    {
      id: 1003,
      body: "OAuth2 flow is working. Need to add refresh token handling.",
      user: mockGitHubUsers.alice,
      created_at: "2026-03-20T09:00:00Z",
      updated_at: "2026-03-20T09:00:00Z",
      html_url: "https://github.com/noovoleum/piper/issues/2#issuecomment-1003",
      issue_url: "https://api.github.com/repos/noovoleum/piper/issues/2",
    },
  ],
}
