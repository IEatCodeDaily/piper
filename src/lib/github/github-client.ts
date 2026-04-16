/**
 * HTTP client for GitHub REST API v3.
 *
 * Handles authentication (PAT / GitHub App), pagination, and error handling.
 * Supports multi-repo operations.
 */

import type {
  GitHubIssue,
  GitHubComment,
  GitHubRepository,
  GitHubLabel,
  GitHubMilestone,
  GitHubCreateIssueRequest,
  GitHubUpdateIssueRequest,
  GitHubListIssuesParams,
  GitHubPaginatedResponse,
} from "./github-types"

// ── Config ─────────────────────────────────────────────────────────────────

export interface GitHubClientConfig {
  /** GitHub API base URL, defaults to "https://api.github.com" */
  baseUrl?: string
  /** Provides the access token (PAT or GitHub App installation token) */
  accessTokenProvider?: () => Promise<string>
  /** Custom fetch implementation (for testing) */
  fetch?: typeof globalThis.fetch
}

// ── Errors ─────────────────────────────────────────────────────────────────

export class GitHubApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown,
  ) {
    super(`GitHub API error: ${status} ${statusText}`)
    this.name = "GitHubApiError"
  }
}

// ── Link Header Parsing ───────────────────────────────────────────────────

function parseLinkHeader(linkHeader: string | null): { next: number | null; last: number | null } {
  if (!linkHeader) return { next: null, last: null }

  let next: number | null = null
  let last: number | null = null

  const parts = linkHeader.split(",")
  for (const part of parts) {
    const match = part.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="([^"]+)"/)
    if (match) {
      const page = parseInt(match[1]!, 10)
      const rel = match[2]!
      if (rel === "next") next = page
      if (rel === "last") last = page
    }
  }

  return { next, last }
}

// ── Client ─────────────────────────────────────────────────────────────────

export class GitHubClient {
  private readonly config: Required<Pick<GitHubClientConfig, "baseUrl">> &
    Pick<GitHubClientConfig, "accessTokenProvider" | "fetch">

  constructor(config: GitHubClientConfig) {
    this.config = {
      ...config,
      baseUrl: (config.baseUrl ?? "https://api.github.com").replace(/\/+$/, ""),
    }
  }

  // ── Issues ───────────────────────────────────────────────────────────────

  async listIssues(
    owner: string,
    repo: string,
    params?: GitHubListIssuesParams,
  ): Promise<GitHubPaginatedResponse<GitHubIssue>> {
    const searchParams = new URLSearchParams()
    if (params?.state) searchParams.set("state", params.state)
    if (params?.milestone !== undefined) searchParams.set("milestone", String(params.milestone))
    if (params?.assignee) searchParams.set("assignee", params.assignee)
    if (params?.labels) searchParams.set("labels", params.labels)
    if (params?.sort) searchParams.set("sort", params.sort)
    if (params?.direction) searchParams.set("direction", params.direction)
    if (params?.since) searchParams.set("since", params.since)
    if (params?.page) searchParams.set("page", String(params.page))
    if (params?.per_page) searchParams.set("per_page", String(params.per_page))

    const query = searchParams.toString()
    return this.requestPaginated<GitHubIssue>(
      "GET",
      `/repos/${owner}/${repo}/issues${query ? `?${query}` : ""}`,
    )
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>("GET", `/repos/${owner}/${repo}/issues/${issueNumber}`)
  }

  async createIssue(
    owner: string,
    repo: string,
    payload: GitHubCreateIssueRequest,
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>("POST", `/repos/${owner}/${repo}/issues`, payload)
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    payload: GitHubUpdateIssueRequest,
  ): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      "PATCH",
      `/repos/${owner}/${repo}/issues/${issueNumber}`,
      payload,
    )
  }

  // ── Comments ─────────────────────────────────────────────────────────────

  async listComments(
    owner: string,
    repo: string,
    issueNumber: number,
    page = 1,
    perPage = 100,
  ): Promise<GitHubPaginatedResponse<GitHubComment>> {
    return this.requestPaginated<GitHubComment>(
      "GET",
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments?page=${page}&per_page=${perPage}`,
    )
  }

  async createComment(
    owner: string,
    repo: string,
    issueNumber: number,
    body: string,
  ): Promise<GitHubComment> {
    return this.request<GitHubComment>(
      "POST",
      `/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      { body },
    )
  }

  // ── Repositories ─────────────────────────────────────────────────────────

  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>("GET", `/repos/${owner}/${repo}`)
  }

  // ── Labels ───────────────────────────────────────────────────────────────

  async listLabels(
    owner: string,
    repo: string,
  ): Promise<GitHubLabel[]> {
    const allLabels: GitHubLabel[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.requestPaginated<GitHubLabel>(
        "GET",
        `/repos/${owner}/${repo}/labels?page=${page}&per_page=100`,
      )
      allLabels.push(...response.data)
      hasMore = response.nextPage !== null
      page = response.nextPage ?? page + 1
    }

    return allLabels
  }

  // ── Milestones ───────────────────────────────────────────────────────────

  async listMilestones(
    owner: string,
    repo: string,
    state: "open" | "closed" | "all" = "open",
  ): Promise<GitHubMilestone[]> {
    const allMilestones: GitHubMilestone[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const response = await this.requestPaginated<GitHubMilestone>(
        "GET",
        `/repos/${owner}/${repo}/milestones?state=${state}&page=${page}&per_page=100`,
      )
      allMilestones.push(...response.data)
      hasMore = response.nextPage !== null
      page = response.nextPage ?? page + 1
    }

    return allMilestones
  }

  // ── Internal ─────────────────────────────────────────────────────────────

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const fetchImpl = this.config.fetch ?? globalThis.fetch
    const url = `${this.config.baseUrl}${path}`

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    const token = await this.config.accessTokenProvider?.()
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const response = await fetchImpl(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      let parsedBody: unknown
      try {
        parsedBody = JSON.parse(errorBody)
      } catch {
        parsedBody = errorBody
      }
      throw new GitHubApiError(response.status, response.statusText, parsedBody)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return response.json() as Promise<T>
  }

  private async requestPaginated<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<GitHubPaginatedResponse<T>> {
    const fetchImpl = this.config.fetch ?? globalThis.fetch
    const url = `${this.config.baseUrl}${path}`

    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json"
    }

    const token = await this.config.accessTokenProvider?.()
    if (token) {
      headers["Authorization"] = `Bearer ${token}`
    }

    const response = await fetchImpl(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      let parsedBody: unknown
      try {
        parsedBody = JSON.parse(errorBody)
      } catch {
        parsedBody = errorBody
      }
      throw new GitHubApiError(response.status, response.statusText, parsedBody)
    }

    const data = (await response.json()) as T[]
    const linkHeader = response.headers.get("Link")
    const { next, last } = parseLinkHeader(linkHeader)

    return {
      data,
      nextPage: next,
      lastPage: last,
    }
  }
}

// ── Mock Client Type ──────────────────────────────────────────────────────

export type GitHubClientLike = Pick<GitHubClient, keyof GitHubClient>
