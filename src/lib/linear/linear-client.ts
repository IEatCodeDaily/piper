/**
 * GraphQL HTTP client for Linear API.
 *
 * Handles authentication (Personal API Key), pagination (cursor-based), and error handling.
 * Reference: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 */

import type {
  LinearComment,
  LinearConnection,
  LinearCreateIssueInput,
  LinearIssue,
  LinearProject,
  LinearTeam,
  LinearUpdateIssueInput,
  LinearUser,
  LinearWorkflowState,
} from "./linear-types"

// ── Config ─────────────────────────────────────────────────────────────────

export interface LinearClientConfig {
  /** Linear API base URL, defaults to "https://api.linear.app/graphql" */
  baseUrl?: string
  /** Provides the Personal API key */
  accessTokenProvider?: () => Promise<string>
  /** Custom fetch implementation (for testing) */
  fetch?: typeof globalThis.fetch
}

// ── Errors ─────────────────────────────────────────────────────────────────

export class LinearApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly errors: unknown[],
  ) {
    const message = errors.length
      ? errors.map((e: any) => e.message ?? String(e)).join("; ")
      : `Linear API error: ${status} ${statusText}`
    super(message)
    this.name = "LinearApiError"
  }
}

// ── GraphQL Response ───────────────────────────────────────────────────────

interface GraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string; path?: string[]; extensions?: unknown }>
}

// ── Client ─────────────────────────────────────────────────────────────────

export class LinearClient {
  private readonly config: Required<Pick<LinearClientConfig, "baseUrl">> &
    Pick<LinearClientConfig, "accessTokenProvider" | "fetch">

  constructor(config: LinearClientConfig) {
    this.config = {
      ...config,
      baseUrl: (config.baseUrl ?? "https://api.linear.app/graphql").replace(/\/+$/, ""),
    }
  }

  // ── Viewer (me) ────────────────────────────────────────────────────────

  async getViewer(): Promise<LinearUser & { teams: LinearConnection<LinearTeam> }> {
    const result = await this.query<{
      viewer: LinearUser & { teams: LinearConnection<LinearTeam> }
    }>(`query {
      viewer {
        id name displayName email avatarUrl active isBot
        teams { nodes { id name key description icon color createdAt updatedAt } pageInfo { hasNextPage endCursor } }
      }
    }`)
    return result.viewer
  }

  // ── Teams ───────────────────────────────────────────────────────────────

  async listTeams(after?: string, first = 50): Promise<LinearConnection<LinearTeam>> {
    const result = await this.query<{
      teams: LinearConnection<LinearTeam>
    }>(`query Teams($after: String, $first: Int) {
      teams(after: $after, first: $first) {
        nodes { id name key description icon color createdAt updatedAt }
        pageInfo { hasNextPage endCursor }
      }
    }`, { after, first })
    return result.teams
  }

  // ── Workflow States ─────────────────────────────────────────────────────

  async listWorkflowStates(teamId: string, after?: string, first = 100): Promise<LinearConnection<LinearWorkflowState>> {
    const result = await this.query<{
      workflowStates: LinearConnection<LinearWorkflowState>
    }>(`query WorkflowStates($filter: WorkflowStateFilter, $after: String, $first: Int) {
      workflowStates(filter: $filter, after: $after, first: $first) {
        nodes { id name type color description }
        pageInfo { hasNextPage endCursor }
      }
    }`, {
      filter: { team: { id: { eq: teamId } } },
      after,
      first,
    })
    return result.workflowStates
  }

  // ── Projects ────────────────────────────────────────────────────────────

  async listProjects(
    filter?: Record<string, unknown>,
    after?: string,
    first = 50,
  ): Promise<LinearConnection<LinearProject>> {
    const result = await this.query<{
      projects: LinearConnection<LinearProject>
    }>(`query Projects($filter: ProjectFilter, $after: String, $first: Int) {
      projects(filter: $filter, after: $after, first: $first) {
            nodes {
              id name description slugId icon color state
              startDate targetDate completedAt canceledAt
              lead { id name displayName email avatarUrl }
              members { nodes { id name displayName email avatarUrl } }
              teams { nodes { id name key } }
              progress
              createdAt updatedAt
            }
            pageInfo { hasNextPage endCursor }
          }
        }`, { filter, after, first })
    return result.projects
  }

  // ── Issues ──────────────────────────────────────────────────────────────

  async listIssues(
    filter?: Record<string, unknown>,
    after?: string,
    first = 50,
  ): Promise<LinearConnection<LinearIssue>> {
    const result = await this.query<{
      issues: LinearConnection<LinearIssue>
    }>(`query Issues($filter: IssueFilter, $after: String, $first: Int) {
      issues(filter: $filter, after: $after, first: $first) {
        nodes {
          id identifier title description url priority sortOrder estimate
          createdAt updatedAt completedAt canceledAt startedAt dueDate
          state { id name type color }
          assignee { id name displayName email avatarUrl }
          creator { id name displayName email avatarUrl }
          labels { nodes { id name color description } }
          project {
            id name description slugId state
            startDate targetDate completedAt
            progress createdAt updatedAt
          }
          team { id name key description }
          cycle { id name startsAt endsAt completedAt progress }
          parent { id identifier title }
          commentCount
        }
        pageInfo { hasNextPage endCursor }
      }
    }`, { filter, after, first })
    return result.issues
  }

  async getIssue(id: string): Promise<LinearIssue> {
    const result = await this.query<{
      issue: LinearIssue
    }>(`query Issue($id: String!) {
      issue(id: $id) {
        id identifier title description url priority sortOrder estimate
        createdAt updatedAt completedAt canceledAt startedAt dueDate
        state { id name type color }
        assignee { id name displayName email avatarUrl }
        creator { id name displayName email avatarUrl }
        labels { nodes { id name color description } }
        project {
          id name description slugId state
          startDate targetDate completedAt
          progress createdAt updatedAt
        }
        team { id name key description }
        cycle { id name startsAt endsAt completedAt progress }
        parent { id identifier title }
        commentCount
      }
    }`, { id })
    return result.issue
  }

  async createIssue(input: LinearCreateIssueInput): Promise<LinearIssue> {
    const result = await this.mutate<{
      issueCreate: { issue: LinearIssue }
    }>(`mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        issue {
          id identifier title description url priority sortOrder estimate
          createdAt updatedAt completedAt canceledAt startedAt dueDate
          state { id name type color }
          assignee { id name displayName email avatarUrl }
          creator { id name displayName email avatarUrl }
          labels { nodes { id name color description } }
          project {
            id name description slugId state
            startDate targetDate completedAt
            progress createdAt updatedAt
          }
          team { id name key description }
          cycle { id name startsAt endsAt completedAt progress }
          parent { id identifier title }
          commentCount
        }
        success
      }
    }`, { input })
    return result.issueCreate.issue
  }

  async updateIssue(id: string, input: LinearUpdateIssueInput): Promise<LinearIssue> {
    const result = await this.mutate<{
      issueUpdate: { issue: LinearIssue }
    }>(`mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) {
        issue {
          id identifier title description url priority sortOrder estimate
          createdAt updatedAt completedAt canceledAt startedAt dueDate
          state { id name type color }
          assignee { id name displayName email avatarUrl }
          creator { id name displayName email avatarUrl }
          labels { nodes { id name color description } }
          project {
            id name description slugId state
            startDate targetDate completedAt
            progress createdAt updatedAt
          }
          team { id name key description }
          cycle { id name startsAt endsAt completedAt progress }
          parent { id identifier title }
          commentCount
        }
        success
      }
    }`, { id, input })
    return result.issueUpdate.issue
  }

  // ── Comments ────────────────────────────────────────────────────────────

  async listComments(
    issueId: string,
    after?: string,
    first = 50,
  ): Promise<LinearConnection<LinearComment>> {
    const result = await this.query<{
      comments: LinearConnection<LinearComment>
    }>(`query Comments($filter: CommentFilter, $after: String, $first: Int) {
      comments(filter: $filter, after: $after, first: $first) {
        nodes {
          id body createdAt updatedAt
          user { id name displayName email avatarUrl }
          issue { id identifier }
          parent { id }
        }
        pageInfo { hasNextPage endCursor }
      }
    }`, {
      filter: { issue: { id: { eq: issueId } } },
      after,
      first,
    })
    return result.comments
  }

  async createComment(issueId: string, body: string): Promise<LinearComment> {
    const result = await this.mutate<{
      commentCreate: { comment: LinearComment }
    }>(`mutation CommentCreate($input: CommentCreateInput!) {
      commentCreate(input: $input) {
        comment {
          id body createdAt updatedAt
          user { id name displayName email avatarUrl }
          issue { id identifier }
        }
        success
      }
    }`, {
      input: { issueId, body },
    })
    return result.commentCreate.comment
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private async query<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    return this.request<T>("query", query, variables)
  }

  private async mutate<T>(mutation: string, variables?: Record<string, unknown>): Promise<T> {
    return this.request<T>("mutation", mutation, variables)
  }

  private async request<T>(
    _operation: "query" | "mutation",
    document: string,
    variables?: Record<string, unknown>,
  ): Promise<T> {
    const fetchImpl = this.config.fetch ?? globalThis.fetch
    const url = this.config.baseUrl

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    const token = await this.config.accessTokenProvider?.()
    if (token) {
      headers["Authorization"] = token
    }

    const response = await fetchImpl(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query: document, variables }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      throw new LinearApiError(response.status, response.statusText, [{ message: errorBody }])
    }

    const json = (await response.json()) as GraphQLResponse<T>

    if (json.errors?.length) {
      throw new LinearApiError(200, "GraphQL Error", json.errors)
    }

    if (!json.data) {
      throw new LinearApiError(200, "No data in response", [])
    }

    return json.data
  }
}

// ── Fetch All Helpers ──────────────────────────────────────────────────────

/**
 * Helper to auto-paginate through all pages of a Linear connection.
 */
export async function fetchAllPages<T>(
  fetchPage: (after?: string) => Promise<LinearConnection<T>>,
): Promise<T[]> {
  const items: T[] = []
  let cursor: string | undefined

  while (true) {
    const connection = await fetchPage(cursor)
    items.push(...connection.nodes)

    if (!connection.pageInfo.hasNextPage || !connection.pageInfo.endCursor) {
      break
    }
    cursor = connection.pageInfo.endCursor
  }

  return items
}

// ── Mock Client Type ──────────────────────────────────────────────────────

export type LinearClientLike = Pick<LinearClient, keyof LinearClient>
