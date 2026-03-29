/**
 * GitHub REST API v3 — TypeScript types for API responses.
 *
 * Reference: https://docs.github.com/en/rest/issues
 */

// ── Users ──────────────────────────────────────────────────────────────────

export interface GitHubUser {
  id: number
  login: string
  avatar_url: string
  html_url: string
  name?: string
  email?: string | null
  type?: "User" | "Bot" | "Organization"
}

// ── Labels ─────────────────────────────────────────────────────────────────

export interface GitHubLabel {
  id: number
  name: string
  color: string
  description?: string | null
  default: boolean
}

// ── Milestone ──────────────────────────────────────────────────────────────

export interface GitHubMilestone {
  id: number
  number: number
  title: string
  description?: string | null
  state: "open" | "closed"
  due_on?: string | null
  created_at: string
  updated_at: string
  closed_at?: string | null
  html_url: string
  creator?: GitHubUser
}

// ── Issue ──────────────────────────────────────────────────────────────────

export interface GitHubIssue {
  id: number
  number: number
  title: string
  body?: string | null
  state: "open" | "closed"
  html_url: string
  user?: GitHubUser | null
  assignee?: GitHubUser | null
  assignees?: GitHubUser[]
  labels: (GitHubLabel | string)[]
  milestone?: GitHubMilestone | null
  created_at: string
  updated_at: string
  closed_at?: string | null
  locked: boolean
  comments: number
  pull_request?: {
    url?: string
    html_url?: string
    diff_url?: string
    patch_url?: string
  }
  repository_url?: string
  // Pull URL for linked PRs
  performed_via_github_app?: unknown
}

// ── Comment ────────────────────────────────────────────────────────────────

export interface GitHubComment {
  id: number
  body?: string | null
  user?: GitHubUser | null
  created_at: string
  updated_at: string
  html_url: string
  issue_url: string
}

// ── Repository ─────────────────────────────────────────────────────────────

export interface GitHubRepository {
  id: number
  name: string
  full_name: string
  owner: GitHubUser
  html_url: string
  description?: string | null
  private: boolean
  open_issues_count: number
  language?: string | null
  created_at: string
  updated_at: string
}

// ── List Issues Response ───────────────────────────────────────────────────

export interface GitHubListIssuesParams {
  milestone?: string | number
  state?: "open" | "closed" | "all"
  assignee?: string
  creator?: string
  labels?: string
  sort?: "created" | "updated" | "comments"
  direction?: "asc" | "desc"
  since?: string
  page?: number
  per_page?: number
}

// ── Create Issue ───────────────────────────────────────────────────────────

export interface GitHubCreateIssueRequest {
  title: string
  body?: string
  assignee?: string
  milestone?: number
  labels?: string[]
  assignees?: string[]
}

// ── Update Issue ───────────────────────────────────────────────────────────

export interface GitHubUpdateIssueRequest {
  title?: string
  body?: string
  state?: "open" | "closed"
  milestone?: number | null
  labels?: string[]
  assignees?: string[]
}

// ── Pagination ─────────────────────────────────────────────────────────────

export interface GitHubPaginatedResponse<T> {
  data: T[]
  nextPage: number | null
  lastPage: number | null
}
