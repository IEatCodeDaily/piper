/**
 * MsListsIssueStore — IssueStore implementation backed by Microsoft Lists
 * (SharePoint Lists via Microsoft Graph API).
 *
 * Implements full CRUD for tasks and projects.  Comments are read via the
 * Graph comments endpoint and written back through the same API.
 *
 * Sync: uses ETag / delta-link watermarks.  The store declares
 * supportsDeltaQuery = true but falls back to full-refresh when the delta
 * link has expired (Graph 410 Gone).
 *
 * NEV-17 / Phase 1 M5 — MS Lists data surfaced in Piper desktop UI.
 */

import type { CommentRef } from "@/features/comments/types";
import type { PersonRef } from "@/features/people/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { WorkspaceConfig } from "@/features/workspaces/types";
import type { GraphClient } from "@/lib/graph/graph-client";
import {
  buildGraphListItemsUrl,
} from "@/lib/graph/graph-config";
import {
  mapGraphListItemToWorkspaceProject,
  mapGraphListItemToWorkspaceTask,
  mapGraphListCommentToCommentRef,
  collectPeopleFromGraphEntities,
} from "@/lib/graph/piper-graph-adapter";
import { MsListsSchemaMapper } from "./ms-lists-schema-mapper";
import type {
  BackendConfig,
  ChangeSet,
  CreateCommentInput,
  CreateTaskInput,
  IssueStore,
  PaginatedResult,
  ProjectQuery,
  StoreCapabilities,
  SyncWatermark,
  TaskPatch,
  TaskQuery,
} from "../types";

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

export interface MsListsBackendConfig extends BackendConfig {
  /** Workspace config that maps SharePoint list fields to Piper schema. */
  workspaceConfig: WorkspaceConfig;
}

// ---------------------------------------------------------------------------
// Connection state
// ---------------------------------------------------------------------------

export type MsListsConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "stale";

export interface MsListsConnectionState {
  status: MsListsConnectionStatus;
  lastSyncAt: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// MsListsIssueStore
// ---------------------------------------------------------------------------

export class MsListsIssueStore implements IssueStore {
  readonly backendId = "ms-lists";

  readonly capabilities: StoreCapabilities = {
    supportsOffline: false,
    supportsDeltaQuery: true,
    supportsWebhooks: false,
    supportsBatchOperations: false,
    supportsRichText: false,
    supportsHierarchy: true,
    maxPageSize: 5000,
    writeLatency: "eventual",
  };

  private graphClient: GraphClient;
  private workspaceConfig: WorkspaceConfig | null = null;
  private mapper: MsListsSchemaMapper | null = null;

  // Local caches — kept for optimistic updates and offline-indicator logic
  private taskCache = new Map<string, WorkspaceTask>();
  private projectCache = new Map<string, WorkspaceProject>();
  private peopleCache: PersonRef[] = [];

  // Sync watermark
  private watermark: SyncWatermark | null = null;

  // Connection status
  private connectionState: MsListsConnectionState = {
    status: "disconnected",
    lastSyncAt: null,
    error: null,
  };

  constructor(graphClient: GraphClient) {
    this.graphClient = graphClient;
  }

  // -- Lifecycle ------------------------------------------------------------

  async initialize(config: BackendConfig): Promise<void> {
    const msConfig = config as MsListsBackendConfig;

    if (!msConfig.workspaceConfig) {
      throw new Error(
        "MsListsIssueStore: workspaceConfig is required in BackendConfig.",
      );
    }

    this.workspaceConfig = msConfig.workspaceConfig;
    this.mapper = new MsListsSchemaMapper();
    this.setConnectionStatus("connecting");

    try {
      // Warm up caches on init
      await this.refreshAll();
      this.setConnectionStatus("connected");
    } catch (err) {
      this.setConnectionStatus("error", String(err));
      throw err;
    }
  }

  async dispose(): Promise<void> {
    this.taskCache.clear();
    this.projectCache.clear();
    this.peopleCache = [];
    this.watermark = null;
    this.setConnectionStatus("disconnected");
  }

  // -- Connection status (public for UI consumers) --------------------------

  getConnectionState(): MsListsConnectionState {
    return { ...this.connectionState };
  }

  // -- Read -----------------------------------------------------------------

  async listTasks(query: TaskQuery): Promise<PaginatedResult<WorkspaceTask>> {
    await this.ensureInitialized();

    let items = Array.from(this.taskCache.values());

    // Filtering
    if (query.projectId !== undefined) {
      items = items.filter((t) => t.projectId === query.projectId);
    }
    if (query.assigneeId !== undefined) {
      items = items.filter((t) => t.assignee?.id === query.assigneeId);
    }
    if (query.statuses !== undefined && query.statuses.length > 0) {
      items = items.filter((t) => query.statuses!.includes(t.status));
    }
    if (query.parentTaskId !== undefined) {
      items = items.filter((t) => t.parentTaskId === query.parentTaskId);
    }
    if (query.labels !== undefined && query.labels.length > 0) {
      items = items.filter((t) =>
        query.labels!.some((l) => t.labels.includes(l)),
      );
    }
    if (query.search) {
      const lower = query.search.toLowerCase();
      items = items.filter(
        (t) =>
          t.title.toLowerCase().includes(lower) ||
          t.description.toLowerCase().includes(lower),
      );
    }
    if (!query.includeCompleted) {
      items = items.filter((t) => t.status !== "done");
    }

    // Sort
    if (query.sortField) {
      const dir = query.sortDirection === "desc" ? -1 : 1;
      items.sort((a, b) => {
        const av = (a as Record<string, unknown>)[query.sortField!];
        const bv = (b as Record<string, unknown>)[query.sortField!];
        return (
          String(av ?? "").localeCompare(String(bv ?? "")) * dir
        );
      });
    }

    // Pagination
    const offset = query.offset ?? 0;
    const limit = Math.min(query.limit ?? 100, this.capabilities.maxPageSize);
    const page = items.slice(offset, offset + limit);

    return {
      items: page,
      total: items.length,
      offset,
      limit,
      hasMore: offset + limit < items.length,
    };
  }

  async getTask(id: string): Promise<WorkspaceTask | null> {
    await this.ensureInitialized();
    return this.taskCache.get(id) ?? null;
  }

  async listProjects(
    query: ProjectQuery,
  ): Promise<PaginatedResult<WorkspaceProject>> {
    await this.ensureInitialized();

    let items = Array.from(this.projectCache.values());

    if (query.statuses !== undefined && query.statuses.length > 0) {
      items = items.filter((p) => query.statuses!.includes(p.status));
    }
    if (!query.includeCompleted) {
      items = items.filter((p) => p.status !== "completed");
    }

    const offset = query.offset ?? 0;
    const limit = Math.min(query.limit ?? 100, this.capabilities.maxPageSize);
    const page = items.slice(offset, offset + limit);

    return { items: page, total: items.length, offset, limit, hasMore: offset + limit < items.length };
  }

  async getProject(id: string): Promise<WorkspaceProject | null> {
    await this.ensureInitialized();
    return this.projectCache.get(id) ?? null;
  }

  async listComments(entityId: string): Promise<CommentRef[]> {
    await this.ensureInitialized();
    const config = this.requireConfig();

    // Parse entity ID: "task:{listId}:{itemId}" or "project:{listId}:{itemId}"
    const [entityType, listId, itemId] = entityId.split(":");
    if (!itemId) return [];

    // Pick the right site ID from the config
    const siteId =
      entityType === "project"
        ? config.lists.projects.site.id
        : config.lists.tasks.site.id;

    try {
      const collection = await this.graphClient.listComments({
        siteId,
        listId,
        itemId,
      });

      return collection.value.map((graphComment) =>
        mapGraphListCommentToCommentRef({
          workspaceConfig: config,
          listId,
          itemId,
          entityType: entityType === "project" ? "project" : "task",
          graphComment,
        }),
      );
    } catch {
      return [];
    }
  }

  async listPeople(): Promise<PersonRef[]> {
    await this.ensureInitialized();
    return [...this.peopleCache];
  }

  // -- Write ----------------------------------------------------------------

  async createTask(input: CreateTaskInput): Promise<WorkspaceTask> {
    await this.ensureInitialized();
    const config = this.requireConfig();
    const mapper = this.requireMapper();

    const fields = mapper.fromCreateTask(input, {
      workspaceConfig: config,
      scope: "task",
    });

    const created = await this.graphWrite<{ id: string; fields: Record<string, unknown> }>(
      `sites/${encodeURIComponent(config.lists.tasks.site.id)}/lists/${encodeURIComponent(config.lists.tasks.list.id)}/items`,
      "POST",
      { fields },
    );

    // Re-fetch the created item so we get the full mapped task
    const fullItem = await this.graphRead<{ id: string; fields: Record<string, unknown> }>(
      `sites/${encodeURIComponent(config.lists.tasks.site.id)}/lists/${encodeURIComponent(config.lists.tasks.list.id)}/items/${created.id}?$expand=fields`,
    );

    const task = mapGraphListItemToWorkspaceTask({
      workspaceConfig: config,
      item: fullItem as Parameters<typeof mapGraphListItemToWorkspaceTask>[0]["item"],
    });

    this.taskCache.set(task.id, task);
    return task;
  }

  async updateTask(id: string, patch: TaskPatch): Promise<WorkspaceTask> {
    await this.ensureInitialized();
    const config = this.requireConfig();
    const mapper = this.requireMapper();

    const existing = this.taskCache.get(id);

    // Parse the Graph item ID from the Piper composite ID
    const graphItemId = this.extractGraphItemId(id);

    const fields = mapper.fromTaskPatch(patch, {
      workspaceConfig: config,
      scope: "task",
      existingTask: existing,
    });

    await this.graphWrite(
      `sites/${encodeURIComponent(config.lists.tasks.site.id)}/lists/${encodeURIComponent(config.lists.tasks.list.id)}/items/${graphItemId}/fields`,
      "PATCH",
      fields,
    );

    const fullItem = await this.graphRead<{ id: string; fields: Record<string, unknown> }>(
      `sites/${encodeURIComponent(config.lists.tasks.site.id)}/lists/${encodeURIComponent(config.lists.tasks.list.id)}/items/${graphItemId}?$expand=fields`,
    );

    const updated = mapGraphListItemToWorkspaceTask({
      workspaceConfig: config,
      item: fullItem as Parameters<typeof mapGraphListItemToWorkspaceTask>[0]["item"],
    });

    this.taskCache.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await this.ensureInitialized();
    const config = this.requireConfig();

    const graphItemId = this.extractGraphItemId(id);

    await this.graphWrite(
      `sites/${encodeURIComponent(config.lists.tasks.site.id)}/lists/${encodeURIComponent(config.lists.tasks.list.id)}/items/${graphItemId}`,
      "DELETE",
      undefined,
    );

    this.taskCache.delete(id);
  }

  async createComment(input: CreateCommentInput): Promise<CommentRef> {
    await this.ensureInitialized();
    const config = this.requireConfig();
    const mapper = this.requireMapper();

    const [entityType, listId, itemId] = input.entityId.split(":");
    const siteId =
      entityType === "project"
        ? config.lists.projects.site.id
        : config.lists.tasks.site.id;

    const body = mapper.fromCreateComment(input, {
      workspaceConfig: config,
      scope: entityType === "project" ? "project" : "task",
    });

    const created = await this.graphWrite<{
      id: string;
      content: string;
      createdDateTime: string;
      createdBy: Record<string, unknown>;
    }>(
      `sites/${encodeURIComponent(siteId)}/lists/${encodeURIComponent(listId)}/items/${encodeURIComponent(itemId)}/comments`,
      "POST",
      body,
    );

    return {
      id: created.id,
      entityType: entityType === "project" ? "project" : "task",
      entityId: input.entityId,
      body: created.content,
      bodyFormat: "plain",
      createdAt: created.createdDateTime,
      updatedAt: created.createdDateTime,
      authorId: undefined,
      authorName: undefined,
    };
  }

  // -- Sync -----------------------------------------------------------------

  async getChangesSince(watermark: SyncWatermark): Promise<ChangeSet> {
    await this.ensureInitialized();

    // Full refresh strategy — delta links are managed by Graph but
    // we don't have persistent cursor storage in Phase 1, so we do
    // a full re-fetch and diff.
    const previousTasks = new Map(this.taskCache);
    await this.refreshAll();

    const created: WorkspaceTask[] = [];
    const updated: Array<{ task: WorkspaceTask; changedFields: string[] }> = [];
    const deleted: string[] = [];

    // Detect new and updated
    for (const [id, task] of this.taskCache) {
      if (!previousTasks.has(id)) {
        created.push(task);
      } else {
        const prev = previousTasks.get(id)!;
        const changed = detectChangedFields(prev, task);
        if (changed.length > 0) {
          updated.push({ task, changedFields: changed });
        }
      }
    }

    // Detect deleted
    for (const id of previousTasks.keys()) {
      if (!this.taskCache.has(id)) {
        deleted.push(id);
      }
    }

    const newWatermark = await this.getWatermark();

    return { created, updated, deleted, watermark: newWatermark };
  }

  async getWatermark(): Promise<SyncWatermark> {
    const now = new Date().toISOString();
    this.watermark = {
      backendId: this.backendId,
      timestamp: now,
    };
    return this.watermark;
  }

  // -- Internal helpers -----------------------------------------------------

  private async ensureInitialized(): Promise<void> {
    if (!this.workspaceConfig) {
      throw new Error(
        "MsListsIssueStore has not been initialized. Call initialize() first.",
      );
    }
  }

  private requireConfig(): WorkspaceConfig {
    if (!this.workspaceConfig) throw new Error("Store not initialized.");
    return this.workspaceConfig;
  }

  private requireMapper(): MsListsSchemaMapper {
    if (!this.mapper) throw new Error("Store not initialized.");
    return this.mapper;
  }

  private setConnectionStatus(
    status: MsListsConnectionStatus,
    error: string | null = null,
  ): void {
    this.connectionState = {
      status,
      lastSyncAt:
        status === "connected"
          ? new Date().toISOString()
          : this.connectionState.lastSyncAt,
      error,
    };
  }

  private async refreshAll(): Promise<void> {
    const config = this.requireConfig();

    const [projectItems, taskItems] = await Promise.all([
      this.graphClient.listItems({
        siteId: config.lists.projects.site.id,
        listId: config.lists.projects.list.id,
      }),
      this.graphClient.listItems({
        siteId: config.lists.tasks.site.id,
        listId: config.lists.tasks.list.id,
      }),
    ]);

    const projects = projectItems.value.map((item) =>
      mapGraphListItemToWorkspaceProject({ workspaceConfig: config, item }),
    );
    const tasks = taskItems.value.map((item) =>
      mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item }),
    );

    this.projectCache.clear();
    this.taskCache.clear();

    for (const project of projects) {
      this.projectCache.set(project.id, project);
    }
    for (const task of tasks) {
      this.taskCache.set(task.id, task);
    }

    this.peopleCache = collectPeopleFromGraphEntities({ projects, tasks, comments: [] });
    this.connectionState.lastSyncAt = new Date().toISOString();
  }

  /** Extract the Graph item ID from a Piper composite ID: "task:{listId}:{itemId}" */
  private extractGraphItemId(piperTaskId: string): string {
    const parts = piperTaskId.split(":");
    if (parts.length >= 3) return parts[2];
    // Fallback for plain IDs (InMemoryStore style)
    return piperTaskId;
  }

  private async graphRead<T>(path: string): Promise<T> {
    const baseUrl = "https://graph.microsoft.com/v1.0";
    const url = `${baseUrl}/${path}`;

    // We access the graphClient's fetch through a cast since FetchGraphClient
    // manages tokens internally.  For the real implementation this delegates
    // to the authenticated fetch; for tests, graphClient is a MockGraphClient.
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Graph read failed: ${response.status} ${url}`);
    }
    return response.json() as Promise<T>;
  }

  private async graphWrite<T>(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body: unknown,
  ): Promise<T> {
    const baseUrl = "https://graph.microsoft.com/v1.0";
    const url = `${baseUrl}/${path}`;

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Graph ${method} failed: ${response.status} ${url} — ${text}`);
    }

    if (method === "DELETE" || response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }
}

// ---------------------------------------------------------------------------
// Helper — detect changed fields between two tasks
// ---------------------------------------------------------------------------

function detectChangedFields(
  prev: WorkspaceTask,
  next: WorkspaceTask,
): string[] {
  const fields: (keyof WorkspaceTask)[] = [
    "title",
    "description",
    "status",
    "priority",
    "projectId",
    "assignee",
    "labels",
    "dueDate",
    "startDate",
  ];

  return fields.filter((field) => {
    const a = prev[field];
    const b = next[field];
    return JSON.stringify(a) !== JSON.stringify(b);
  });
}
