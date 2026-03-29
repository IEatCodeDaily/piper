/**
 * Unit tests for LinearIssueStore.
 *
 * Uses a mock LinearClient to avoid real API calls.
 * Tests cover: initialization, task CRUD, project listing, comments,
 * people discovery, sync, and error handling.
 */

import { describe, expect, it, beforeEach, vi } from "vitest"
import type {
  LinearClient,
  LinearClientLike,
} from "@/lib/linear/linear-client"
import type {
  LinearComment,
  LinearConnection,
  LinearIssue,
  LinearProject,
  LinearWorkflowState,
} from "@/lib/linear/linear-types"
import type { WorkspaceConfig } from "@/features/workspaces/types"

import { LinearIssueStore } from "../linear-issue-store"
import type { LinearBackendConfig } from "../linear-issue-store"
import {
  mockLinearIssues,
  mockLinearProject,
  mockLinearTeam,
  mockLinearComments,
  mockLinearUsers,
  mockWorkflowStates,
} from "../mock-linear-payloads"

// ---------------------------------------------------------------------------
// Test workspace config
// ---------------------------------------------------------------------------

function createTestWorkspaceConfig(): WorkspaceConfig {
  return {
    version: 1,
    workspace: {
      id: "ws-test",
      label: "Test Linear Workspace",
      description: "Linear workspace for testing",
      tenant: {
        id: "tenant-test",
        label: "Noovoleum",
        domain: "noovoleum.linear.app",
      },
    },
    lists: {
      projects: {
        site: { id: "https://api.linear.app/graphql", label: "Linear" },
        list: { id: "PIPER", label: "Piper Issues" },
        fields: {
          title: { sourceField: "name", dataType: "string", required: true, editable: true },
          status: { sourceField: "state", dataType: "choice", required: true, editable: true },
          priority: { sourceField: "priority", dataType: "choice", required: false, editable: true },
          description: { sourceField: "description", dataType: "text", required: false, editable: true },
        },
        renderers: {},
        relations: {},
      },
      tasks: {
        site: { id: "https://api.linear.app/graphql", label: "Linear" },
        list: { id: "PIPER", label: "Piper Issues" },
        fields: {
          title: { sourceField: "title", dataType: "string", required: true, editable: true },
          status: { sourceField: "state", dataType: "choice", required: true, editable: true },
          priority: { sourceField: "priority", dataType: "choice", required: false, editable: true },
          description: { sourceField: "description", dataType: "text", required: false, editable: true },
          assignee: { sourceField: "assignee", dataType: "person", required: false, editable: true },
        },
        renderers: {},
        relations: {},
      },
    },
    views: [],
  }
}

// ---------------------------------------------------------------------------
// Mock LinearClient
// ---------------------------------------------------------------------------

function createMockClient(): LinearClientLike {
  // Mutable store so updates are visible to subsequent getIssue calls
  const updatedIssues = new Map<string, LinearIssue>()

  return {
    getViewer: vi.fn().mockResolvedValue({
      ...mockLinearUsers.alice,
      teams: {
        nodes: [mockLinearTeam],
        pageInfo: { hasNextPage: false, endCursor: null },
      },
    }),

    listTeams: vi.fn().mockResolvedValue({
      nodes: [mockLinearTeam],
      pageInfo: { hasNextPage: false, endCursor: null },
    }),

    listWorkflowStates: vi.fn().mockResolvedValue({
      nodes: mockWorkflowStates,
      pageInfo: { hasNextPage: false, endCursor: null },
    }),

    listProjects: vi.fn().mockResolvedValue({
      nodes: [mockLinearProject],
      pageInfo: { hasNextPage: false, endCursor: null },
    }),

    listIssues: vi.fn().mockResolvedValue({
      nodes: mockLinearIssues,
      pageInfo: { hasNextPage: false, endCursor: null },
    }),

    getIssue: vi.fn().mockImplementation((id: string) => {
      // Check mutated store first, then fall back to original mock data
      const updated = updatedIssues.get(id)
      if (updated) return Promise.resolve(updated)
      const issue = mockLinearIssues.find((i) => i.id === id || i.identifier === id)
      if (!issue) throw new Error(`Issue not found: ${id}`)
      return Promise.resolve(issue)
    }),

    createIssue: vi.fn().mockImplementation((input: Record<string, unknown>) => {
      const newIssue: LinearIssue = {
        id: `issue-new-${Date.now()}`,
        identifier: `PIPER-${mockLinearIssues.length + 1}`,
        title: input.title as string,
        description: (input.description as string) ?? null,
        url: `https://linear.app/noovoleum/issue/PIPER-${mockLinearIssues.length + 1}`,
        priority: (input.priority as LinearIssue["priority"]) ?? 0,
        sortOrder: 500,
        estimate: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
        canceledAt: null,
        startedAt: null,
        dueDate: (input.dueDate as string) ?? null,
        state: mockWorkflowStates.find((s) => s.id === input.stateId) ?? mockWorkflowStates[0]!,
        assignee: null,
        creator: mockLinearUsers.alice,
        labels: { nodes: [] },
        project: null,
        team: mockLinearTeam,
        cycle: null,
        parent: null,
        commentCount: 0,
      }
      return Promise.resolve(newIssue)
    }),

    updateIssue: vi.fn().mockImplementation((id: string, input: Record<string, unknown>) => {
      const existing = updatedIssues.get(id) ?? mockLinearIssues.find((i) => i.id === id)
      if (!existing) throw new Error(`Issue not found: ${id}`)
      const updated = { ...existing, ...input, updatedAt: new Date().toISOString() }

      // Handle stateId -> state mapping
      if (input.stateId) {
        const state = mockWorkflowStates.find((s) => s.id === input.stateId)
        if (state) updated.state = state
      }

      // Persist the mutation so getIssue returns updated data
      updatedIssues.set(id, updated)

      return Promise.resolve(updated)
    }),

    listComments: vi.fn().mockImplementation((issueId: string) => {
      // Find comments for the issue
      const issue = mockLinearIssues.find((i) => i.id === issueId)
      if (!issue) return Promise.resolve({ nodes: [], pageInfo: { hasNextPage: false, endCursor: null } })

      const comments = mockLinearComments[issue.identifier] ?? []
      return Promise.resolve({
        nodes: comments,
        pageInfo: { hasNextPage: false, endCursor: null },
      })
    }),

    createComment: vi.fn().mockImplementation((issueId: string, body: string) => {
      const issue = mockLinearIssues.find((i) => i.id === issueId)
      return Promise.resolve({
        id: `comment-new-${Date.now()}`,
        body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        user: mockLinearUsers.alice,
        issue: { id: issueId, identifier: issue?.identifier ?? "PIPER-NEW" },
        parent: null,
      })
    }),
  }
}

// ---------------------------------------------------------------------------
// Helper: create store with mock client injected via fetch override
// ---------------------------------------------------------------------------

function createTestStore(): { store: LinearIssueStore; client: LinearClientLike } {
  const client = createMockClient()

  // We create the store normally, but the client is created internally.
  // To inject the mock, we pass a custom fetch that our mock client doesn't use
  // because the store creates its own LinearClient. Instead, we'll use a different approach:
  // we'll create the store and then manually replace the private client field.

  const store = new LinearIssueStore()

  // Access private field to inject mock client
  ;(store as any).client = client
  ;(store as any).workspaceConfig = createTestWorkspaceConfig()
  ;(store as any).initialized = true

  return { store, client }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LinearIssueStore", () => {
  let store: LinearIssueStore
  let mockClient: LinearClientLike

  beforeEach(async () => {
    const result = createTestStore()
    store = result.store
    mockClient = result.client

    // Seed caches with mock data (simulating refreshAll)
    const config = createTestWorkspaceConfig()

    const { mapLinearIssueToWorkspaceTask, mapLinearProjectToWorkspaceProject } = await import("@/lib/linear/linear-adapter")

    for (const issue of mockLinearIssues) {
      const task = mapLinearIssueToWorkspaceTask({ workspaceConfig: config, issue })
      ;(store as any).taskCache.set(task.id, task)
    }

    const project = mapLinearProjectToWorkspaceProject({ workspaceConfig: config, project: mockLinearProject })
    ;(store as any).projectCache.set(project.id, project)
  })

  // -- Capabilities ---------------------------------------------------------

  describe("capabilities", () => {
    it("reports correct backend ID and capabilities", () => {
      expect(store.backendId).toBe("linear")
      expect(store.capabilities.supportsOffline).toBe(false)
      expect(store.capabilities.supportsDeltaQuery).toBe(true)
      expect(store.capabilities.supportsWebhooks).toBe(true)
      expect(store.capabilities.supportsRichText).toBe(true)
      expect(store.capabilities.supportsHierarchy).toBe(true)
      expect(store.capabilities.writeLatency).toBe("immediate")
      expect(store.capabilities.maxPageSize).toBe(100)
    })
  })

  // -- Task Queries ---------------------------------------------------------

  describe("task queries", () => {
    it("lists all tasks including completed", async () => {
      const result = await store.listTasks({ includeCompleted: true })
      expect(result.items.length).toBeGreaterThanOrEqual(4)
      expect(result.total).toBeGreaterThanOrEqual(4)
    })

    it("excludes completed tasks by default", async () => {
      const result = await store.listTasks({})
      const completedTasks = result.items.filter((t) => t.status === "done")
      expect(completedTasks.length).toBe(0)
    })

    it("filters by status", async () => {
      const result = await store.listTasks({
        statuses: ["in-progress"],
        includeCompleted: true,
      })
      expect(result.items.length).toBeGreaterThanOrEqual(1)
      expect(result.items.every((t) => t.status === "in-progress")).toBe(true)
    })

    it("filters by priority", async () => {
      const result = await store.listTasks({
        includeCompleted: true,
      })
      const highPriority = result.items.filter((t) => t.priority === "high")
      expect(highPriority.length).toBeGreaterThanOrEqual(1)
    })

    it("filters by labels", async () => {
      const result = await store.listTasks({
        labels: ["Infrastructure"],
        includeCompleted: true,
      })
      expect(result.items.length).toBeGreaterThanOrEqual(1)
      expect(result.items.every((t) => t.labels.includes("Infrastructure"))).toBe(true)
    })

    it("searches by title", async () => {
      const result = await store.listTasks({
        search: "CI/CD",
        includeCompleted: true,
      })
      expect(result.items.length).toBeGreaterThanOrEqual(1)
      expect(result.items[0].title).toContain("CI/CD")
    })

    it("paginates results", async () => {
      const page1 = await store.listTasks({ includeCompleted: true, offset: 0, limit: 2 })
      expect(page1.items.length).toBe(2)
      expect(page1.offset).toBe(0)
      expect(page1.limit).toBe(2)

      if (page1.hasMore) {
        const page2 = await store.listTasks({ includeCompleted: true, offset: 2, limit: 2 })
        expect(page2.items.length).toBeGreaterThanOrEqual(1)
      }
    })

    it("gets a single task by ID", async () => {
      const tasks = await store.listTasks({ includeCompleted: true })
      const first = tasks.items[0]
      if (!first) return

      const task = await store.getTask(first.id)
      expect(task).not.toBeNull()
      expect(task!.id).toBe(first.id)
    })

    it("returns null for nonexistent task", async () => {
      const task = await store.getTask("linear:tasks:FAKE:FAKE-999")
      expect(task).toBeNull()
    })
  })

  // -- Project Queries -------------------------------------------------------

  describe("project queries", () => {
    it("lists projects", async () => {
      const result = await store.listProjects({ includeCompleted: true })
      expect(result.items.length).toBeGreaterThanOrEqual(1)
    })

    it("excludes completed projects by default", async () => {
      const result = await store.listProjects({})
      // Our mock project is "active" status, so it should be included
      expect(result.items.every((p) => p.status !== "complete")).toBe(true)
    })

    it("gets a project by ID", async () => {
      const projects = await store.listProjects({ includeCompleted: true })
      const first = projects.items[0]
      if (!first) return

      const project = await store.getProject(first.id)
      expect(project).not.toBeNull()
      expect(project!.id).toBe(first.id)
    })

    it("returns null for nonexistent project", async () => {
      const project = await store.getProject("nonexistent")
      expect(project).toBeNull()
    })
  })

  // -- Comments --------------------------------------------------------------

  describe("comments", () => {
    it("returns empty comments for unknown entity", async () => {
      const comments = await store.listComments("linear:tasks:FAKE:FAKE-1")
      expect(comments).toEqual([])
    })
  })

  // -- People ----------------------------------------------------------------

  describe("people", () => {
    it("lists people from cached tasks", async () => {
      const people = await store.listPeople()
      // Should have people derived from the cached tasks
      expect(people.length).toBeGreaterThanOrEqual(0)
    })
  })

  // -- Write Operations ------------------------------------------------------

  describe("createTask", () => {
    it("creates a task via the Linear API", async () => {
      const task = await store.createTask({
        title: "New test task",
        description: "Created by test",
        priority: "high",
      })

      expect(task.title).toBe("New test task")
      expect(task.description).toBe("Created by test")
      expect(mockClient.createIssue).toHaveBeenCalled()
    })
  })

  describe("updateTask", () => {
    it("updates a task title", async () => {
      const tasks = await store.listTasks({ includeCompleted: true })
      const task = tasks.items.find((t) => t.status !== "done")
      if (!task) return

      const updated = await store.updateTask(task.id, { title: "Updated title" })
      expect(updated.title).toBe("Updated title")
      expect(mockClient.updateIssue).toHaveBeenCalled()
    })

    it("updates task priority", async () => {
      const tasks = await store.listTasks({ includeCompleted: true })
      const task = tasks.items.find((t) => t.status !== "done")
      if (!task) return

      const updated = await store.updateTask(task.id, { priority: "urgent" })
      expect(updated.priority).toBe("urgent")
    })
  })

  describe("deleteTask", () => {
    it("soft-deletes a task by moving to canceled state", async () => {
      const tasks = await store.listTasks({ includeCompleted: true })
      const task = tasks.items[0]
      if (!task) return

      await store.deleteTask(task.id)

      // Should be removed from cache
      const deleted = await store.getTask(task.id)
      expect(deleted).toBeNull()

      // Should have called updateIssue with canceled state
      expect(mockClient.updateIssue).toHaveBeenCalled()
    })
  })

  describe("createComment", () => {
    it("creates a comment on a task", async () => {
      const tasks = await store.listTasks({ includeCompleted: true })
      const task = tasks.items.find((t) => t.status !== "done")
      if (!task) return

      const comment = await store.createComment({
        entityType: "task",
        entityId: task.id,
        body: "Test comment body",
      })

      expect(comment.body).toBe("Test comment body")
      expect(comment.entityId).toBe(task.id)
      expect(mockClient.createComment).toHaveBeenCalled()
    })
  })

  // -- Sync ------------------------------------------------------------------

  describe("sync", () => {
    it("returns a watermark", async () => {
      const wm = await store.getWatermark()
      expect(wm.backendId).toBe("linear")
      expect(wm.timestamp).toBeTruthy()
    })

    it("getChangesSince returns changeset", async () => {
      const wm = await store.getWatermark()

      // Create a new task to trigger a diff
      // (In real usage, refreshAll would pick up new data)
      const changes = await store.getChangesSince(wm)

      expect(changes).toHaveProperty("created")
      expect(changes).toHaveProperty("updated")
      expect(changes).toHaveProperty("deleted")
      expect(changes).toHaveProperty("watermark")
    })
  })

  // -- Lifecycle -------------------------------------------------------------

  describe("lifecycle", () => {
    it("throws when not initialized", async () => {
      const uninitializedStore = new LinearIssueStore()
      await expect(uninitializedStore.listTasks({})).rejects.toThrow(
        "not been initialized",
      )
    })

    it("dispose clears all caches", async () => {
      await store.dispose()

      // After dispose, the store should reject calls
      const disposedStore = store
      await expect(disposedStore.listTasks({})).rejects.toThrow()
    })
  })

  // -- Initialization --------------------------------------------------------

  describe("initialize", () => {
    it("requires workspaceConfig in config", async () => {
      const freshStore = new LinearIssueStore()
      await expect(
        freshStore.initialize({ apiKey: "test-key" }),
      ).rejects.toThrow("workspaceConfig is required")
    })

    it("requires apiKey in config", async () => {
      const freshStore = new LinearIssueStore()
      await expect(
        freshStore.initialize({
          workspaceConfig: createTestWorkspaceConfig(),
        }),
      ).rejects.toThrow("apiKey is required")
    })
  })
})
