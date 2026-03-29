/**
 * Tests for the GitHub Issues adapter mapping functions.
 */

import { describe, it, expect } from "vitest"
import { mockGitHubIssues, mockGitHubRepo, mockGitHubComments } from "../mock-github-payloads"
import {
  mapGitHubIssueToWorkspaceTask,
  mapGitHubRepoToWorkspaceProject,
  mapGitHubCommentToCommentRef,
  mapGitHubUser,
} from "../github-adapter"
import type { WorkspaceConfig } from "@/features/workspaces/types"

// ── Test Workspace Config ──────────────────────────────────────────────────

const testWorkspaceConfig: WorkspaceConfig = {
  version: 1,
  workspace: {
    id: "ws-github-test",
    label: "GitHub Test Workspace",
    description: "Test workspace backed by GitHub Issues",
    tenant: {
      id: "https://api.github.com",
      label: "GitHub",
      domain: "github.com",
    },
  },
  lists: {
    projects: {
      site: { id: "https://api.github.com", label: "GitHub" },
      list: { id: "noovoleum/piper", label: "Piper Repository" },
      fields: {
        title: { sourceField: "name", dataType: "string", required: true, editable: false },
        description: { sourceField: "description", dataType: "text", required: false, editable: false },
      },
    },
    tasks: {
      site: { id: "https://api.github.com", label: "GitHub" },
      list: { id: "noovoleum/piper", label: "Piper Issues" },
      fields: {
        title: { sourceField: "title", dataType: "string", required: true, editable: true },
        description: { sourceField: "body", dataType: "markdown", required: false, editable: true },
        status: { sourceField: "state", dataType: "choice", required: true, editable: true },
        priority: { sourceField: "labels", dataType: "labels", required: false, editable: true },
        assignee: { sourceField: "assignee", dataType: "person", required: false, editable: true },
        reporter: { sourceField: "user", dataType: "person", required: false, editable: false },
        labels: { sourceField: "labels", dataType: "labels", required: false, editable: true },
        dueDate: { sourceField: "milestone.due_on", dataType: "date", required: false, editable: true },
      },
    },
  },
  views: [],
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("mapGitHubIssueToWorkspaceTask", () => {
  it("maps a GitHub issue with all fields to a WorkspaceTask", () => {
    const issue = mockGitHubIssues[0]! // Issue #1: open, assigned to Alice
    const task = mapGitHubIssueToWorkspaceTask({ workspaceConfig: testWorkspaceConfig, issue })

    expect(task.externalId).toBe("1")
    expect(task.title).toBe("Set up CI/CD pipeline")
    expect(task.status).toBe("planned") // open, no special labels
    expect(task.priority).toBe("low") // no priority labels
    expect(task.description).toContain("Configure GitHub Actions")
    expect(task.assignee?.displayName).toBe("Alice Chen")
    expect(task.assignee?.email).toBe("alice@example.com")
    expect(task.reporter?.displayName).toBe("Bob Martinez")
    expect(task.labels).toEqual(["devops", "automation"])
    expect(task.workspaceId).toBe("ws-github-test")
    expect(task.projectCode).toBe("noovoleum/piper")
    expect(task.id).toContain("github:tasks:noovoleum/piper:1")
  })

  it("maps a closed GitHub issue correctly", () => {
    const issue = mockGitHubIssues[1]! // Issue #2: closed
    const task = mapGitHubIssueToWorkspaceTask({ workspaceConfig: testWorkspaceConfig, issue })

    expect(task.externalId).toBe("2")
    expect(task.status).toBe("done") // closed -> done
    expect(task.priority).toBe("high") // high-priority label
    expect(task.completedAt).toBe("2026-03-25T12:00:00Z")
  })

  it("maps a GitHub issue with no assignee", () => {
    const issue = mockGitHubIssues[2]! // Issue #3: open, no assignee
    const task = mapGitHubIssueToWorkspaceTask({ workspaceConfig: testWorkspaceConfig, issue })

    expect(task.status).toBe("planned") // open, docs label
    expect(task.priority).toBe("low")
    expect(task.assignee?.id).toBe("unknown") // null GitHub user maps to fallback
    expect(task.description).toBe("")
  })

  it("maps a GitHub issue with blocked label", () => {
    const issue = mockGitHubIssues[3]! // Issue #4: open, blocked label
    const task = mapGitHubIssueToWorkspaceTask({ workspaceConfig: testWorkspaceConfig, issue })

    expect(task.status).toBe("blocked") // blocked label override
    expect(task.title).toBe("Fix responsive layout bugs")
    expect(task.labels).toContain("bug")
    expect(task.labels).toContain("ui")
    expect(task.labels).toContain("blocked")
  })

  it("maps a pull request and marks it internally", () => {
    const issue = mockGitHubIssues[4]! // Issue #5: has pull_request field
    const task = mapGitHubIssueToWorkspaceTask({ workspaceConfig: testWorkspaceConfig, issue }) as WorkspaceTask & { _isPullRequest?: boolean }

    expect(task.title).toBe("Add README.md")
    expect(task._isPullRequest).toBe(true)
  })

  it("generates stable IDs", () => {
    const issue = mockGitHubIssues[0]!
    const task1 = mapGitHubIssueToWorkspaceTask({ workspaceConfig: testWorkspaceConfig, issue })
    const task2 = mapGitHubIssueToWorkspaceTask({ workspaceConfig: testWorkspaceConfig, issue })

    expect(task1.id).toBe(task2.id)
    expect(task1.externalId).toBe(task2.externalId)
  })
})

describe("mapGitHubRepoToWorkspaceProject", () => {
  it("maps a GitHub repository to a WorkspaceProject", () => {
    const project = mapGitHubRepoToWorkspaceProject({
      workspaceConfig: testWorkspaceConfig,
      repository: mockGitHubRepo,
    })

    expect(project.externalId).toBe("noovoleum/piper")
    expect(project.projectCode).toBe("noovoleum/piper")
    expect(project.title).toBe("piper")
    expect(project.description).toBe("Piper project management application")
    expect(project.owner.displayName).toBe("Alice Chen")
    expect(project.workspaceId).toBe("ws-github-test")
    expect(project.status).toBe("active")
    expect(project.openTaskCount).toBe(3)
  })
})

describe("mapGitHubCommentToCommentRef", () => {
  it("maps a GitHub comment", () => {
    const comment = mockGitHubComments[1]![0]!
    const ref = mapGitHubCommentToCommentRef({
      workspaceConfig: testWorkspaceConfig,
      repoFullName: "noovoleum/piper",
      issueNumber: 1,
      entityType: "task",
      comment,
    })

    expect(ref.externalId).toBe("1001")
    expect(ref.body).toContain("Started working on the GitHub Actions workflow")
    expect(ref.author.displayName).toBe("Bob Martinez")
    expect(ref.entityType).toBe("task")
    expect(ref.bodyFormat).toBe("markdown")
    expect(ref.edited).toBe(false)
  })

  it("maps a GitHub comment that has been edited", () => {
    const comment = mockGitHubComments[1]![1]!
    const ref = mapGitHubCommentToCommentRef({
      workspaceConfig: testWorkspaceConfig,
      repoFullName: "noovoleum/piper",
      issueNumber: 1,
      entityType: "task",
      comment,
    })

    expect(ref.body).toBe("Need to add integration tests before merging.")
    expect(ref.edited).toBe(true)
    expect(ref.updatedAt).toBeDefined()
  })

  it("maps a comment that has not been edited", () => {
    const comment = mockGitHubComments[2]![0]!
    const ref = mapGitHubCommentToCommentRef({
      workspaceConfig: testWorkspaceConfig,
      repoFullName: "noovoleum/piper",
      issueNumber: 2,
      entityType: "task",
      comment,
    })

    expect(ref.edited).toBe(false)
    expect(ref.updatedAt).toBeUndefined()
  })
})

describe("status mapping", () => {
  it("maps GitHub state + labels correctly", () => {
    const testCases = [
      { state: "closed" as const, labels: [] as string[], expected: "done" },
      { state: "open" as const, labels: ["blocked"], expected: "blocked" },
      { state: "open" as const, labels: ["in-review"], expected: "in-review" },
      { state: "open" as const, labels: ["in-progress"], expected: "in-progress" },
      { state: "open" as const, labels: ["backlog"], expected: "backlog" },
      { state: "open" as const, labels: ["wip"], expected: "in-progress" },
      { state: "open" as const, labels: [], expected: "planned" },
    ]

    for (const { state, labels, expected } of testCases) {
      const issue = {
        ...mockGitHubIssues[0]!,
        state,
        labels: labels.map((name) => ({ id: 1, name, color: "fff", default: false })),
      }
      const task = mapGitHubIssueToWorkspaceTask({ workspaceConfig: testWorkspaceConfig, issue })
      expect(task.status).toBe(expected)
    }
  })
})

describe("priority mapping", () => {
  it("maps GitHub priority labels correctly", () => {
    const testCases = [
      { labels: ["critical"], expected: "urgent" },
      { labels: ["blocker"], expected: "urgent" },
      { labels: ["high-priority"], expected: "high" },
      { labels: ["medium"], expected: "medium" },
      { labels: [], expected: "low" },
      { labels: ["enhancement"], expected: "low" },
    ]

    for (const { labels, expected } of testCases) {
      const issue = {
        ...mockGitHubIssues[0]!,
        labels: labels.map((name) => ({ id: 1, name, color: "fff", default: false })),
      }
      const task = mapGitHubIssueToWorkspaceTask({ workspaceConfig: testWorkspaceConfig, issue })
      expect(task.priority).toBe(expected)
    }
  })
})

describe("mapGitHubUser", () => {
  it("maps a GitHub user with name", () => {
    const user = { id: 1, login: "testuser", name: "Test User", email: "test@example.com", avatar_url: "https://avatar.url", html_url: "https://github.com/testuser", type: "User" as const }
    const person = mapGitHubUser(user)
    expect(person.id).toBe("1")
    expect(person.externalId).toBe("testuser")
    expect(person.displayName).toBe("Test User")
    expect(person.email).toBe("test@example.com")
    expect(person.avatarUrl).toBe("https://avatar.url")
  })

  it("maps a GitHub user without name (uses login)", () => {
    const user = { id: 2, login: "nologin", avatar_url: "", html_url: "", type: "User" as const }
    const person = mapGitHubUser(user)
    expect(person.displayName).toBe("nologin")
    expect(person.email).toBe("nologin@users.noreply.github.com")
  })

  it("maps a null GitHub user to unknown fallback", () => {
    const person = mapGitHubUser(null)
    expect(person.id).toBe("unknown")
    expect(person.displayName).toBe("Unknown person")
  })
})
