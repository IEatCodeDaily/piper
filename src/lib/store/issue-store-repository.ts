/**
 * IssueStoreRepository — Adapts an IssueStore into a PiperRepository.
 *
 * This is the bridge between the backend-agnostic IssueStore layer and the
 * existing PiperRepository interface that the UI programs against. Adding a
 * new backend does NOT require touching this file; you only implement a new
 * IssueStore + SchemaMapper + AuthProvider.
 *
 * Key invariant: the PiperRepository contract stays unchanged. UI code is
 * never aware of which backend is active.
 */

import type { CommentRef } from "@/features/comments/types";
import type { PersonRef } from "@/features/people/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { PiperWorkspace } from "@/lib/domain/workspace";
import type {
  CreateCommentInput as RepoCreateCommentInput,
  CreateTaskInput as RepoCreateTaskInput,
  PiperRepository,
  TaskUpdateInput,
  WorkspaceProjectQuery,
  WorkspaceTaskQuery,
} from "@/lib/repository/piper-repository";
import type { IssueStore } from "./types";

export interface IssueStoreRepositoryConfig {
  /** Workspace metadata for the PiperWorkspace objects returned by the repo. */
  workspace: {
    id: string;
    slug: string;
    name: string;
    description: string;
    tenantName: string;
  };
}

/**
 * Implements PiperRepository by delegating to an IssueStore.
 *
 * Usage:
 * ```ts
 * const store = msListsFactory.createStore(backendConfig);
 * await store.initialize(backendConfig);
 *
 * const repo = new IssueStoreRepository(store, {
 *   workspace: { id: "ws-1", slug: "core-ops", name: "Core Operations", ... }
 * });
 *
 * setPiperRepository(repo);
 * ```
 */
export class IssueStoreRepository implements PiperRepository {
  constructor(
    private readonly store: IssueStore,
    private readonly config: IssueStoreRepositoryConfig,
  ) {}

  async listWorkspaces(): Promise<PiperWorkspace[]> {
    // For now, a single store = a single workspace.
    // Multi-workspace support can be added by wrapping multiple stores.
    const workspace = await this.buildWorkspaceSummary();
    return [workspace];
  }

  async getActiveWorkspace(): Promise<PiperWorkspace> {
    return this.buildWorkspaceSummary();
  }

  async listWorkspacePeople(_workspaceId: string): Promise<PersonRef[]> {
    return this.store.listPeople();
  }

  async listWorkspaceProjects(
    query: WorkspaceProjectQuery,
  ): Promise<WorkspaceProject[]> {
    const result = await this.store.listProjects({
      parentProjectId: query.parentProjectId,
      includeCompleted: query.includeCompleted,
    });
    return result.items;
  }

  async listWorkspaceTasks(
    query: WorkspaceTaskQuery,
  ): Promise<WorkspaceTask[]> {
    const result = await this.store.listTasks({
      projectId: query.projectId,
      assigneeId: query.assigneeId,
      statuses: query.statuses,
      includeCompleted: query.includeCompleted,
    });
    return result.items;
  }

  async listWorkspaceComments(_workspaceId: string): Promise<CommentRef[]> {
    // IssueStore.listComments is per-entity; for workspace-wide comments
    // we'd need to aggregate. For now, return empty — the caller should
    // fetch comments per task/project via the detail views.
    return [];
  }

  async updateTask(input: TaskUpdateInput): Promise<WorkspaceTask> {
    return this.store.updateTask(input.taskId, input.patch);
  }

  async createTask(input: RepoCreateTaskInput): Promise<WorkspaceTask> {
    return this.store.createTask({
      title: input.title,
      status: input.status,
      priority: input.priority,
      projectId: input.projectId,
      assigneeId: input.assigneeId,
      labels: input.labels,
      startDate: input.startDate,
      dueDate: input.dueDate,
    });
  }

  async createComment(input: RepoCreateCommentInput): Promise<CommentRef> {
    return this.store.createComment({
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body,
      bodyFormat: input.bodyFormat,
    });
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private async buildWorkspaceSummary(): Promise<PiperWorkspace> {
    const [tasks, projects] = await Promise.all([
      this.store.listTasks({ includeCompleted: true }),
      this.store.listProjects({ includeCompleted: true }),
    ]);

    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    return {
      id: this.config.workspace.id,
      slug: this.config.workspace.slug,
      name: this.config.workspace.name,
      description: this.config.workspace.description,
      tenantName: this.config.workspace.tenantName,
      mode: "graph", // IssueStore-backed workspaces report as "graph" for UI compat
      sourceRefs: [],
      presets: [],
      summary: {
        taskCount: tasks.items.length,
        projectCount: projects.items.length,
        openTaskCount: tasks.items.filter((t) => t.status !== "done").length,
        overdueTaskCount: tasks.items.filter(
          (t) => t.dueDate !== undefined && t.dueDate < today && t.status !== "done",
        ).length,
      },
      createdAt: now,
      updatedAt: now,
    };
  }
}
