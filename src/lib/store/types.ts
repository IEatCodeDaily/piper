/**
 * IssueStore — Backend-agnostic storage abstraction for Piper.
 *
 * Every data backend (Microsoft Lists, SQLite, GitHub Issues, Jira, etc.)
 * implements `IssueStore`. The rest of Piper (UI, sync engine, repository)
 * programs against this interface, never against backend-specific APIs.
 *
 * Design invariants:
 *   - All methods operate on Piper-native types (WorkspaceTask, etc.).
 *   - Schema translation is handled by the companion SchemaMapper.
 *   - Capabilities are declared, not probed at runtime.
 *   - Sync state is watermark-based and backend-opaque.
 */

import type { CommentRef } from "@/features/comments/types";
import type { PersonRef } from "@/features/people/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";

// ---------------------------------------------------------------------------
// Query types
// ---------------------------------------------------------------------------

export interface TaskQuery {
  projectId?: string;
  assigneeId?: string;
  statuses?: WorkspaceTask["status"][];
  parentTaskId?: string;
  labels?: string[];
  search?: string;
  includeCompleted?: boolean;
  offset?: number;
  limit?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
}

export interface ProjectQuery {
  parentProjectId?: string;
  statuses?: WorkspaceProject["status"][];
  includeCompleted?: boolean;
  offset?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Mutation inputs
// ---------------------------------------------------------------------------

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: WorkspaceTask["status"];
  priority?: WorkspaceTask["priority"];
  projectId?: string;
  parentTaskId?: string;
  assigneeId?: string;
  labels?: string[];
  startDate?: string;
  dueDate?: string;
}

export interface TaskPatch {
  title?: string;
  description?: string;
  status?: WorkspaceTask["status"];
  priority?: WorkspaceTask["priority"];
  projectId?: string | null;
  parentTaskId?: string | null;
  assigneeId?: string | null;
  labels?: string[];
  startDate?: string | null;
  dueDate?: string | null;
}

export interface CreateCommentInput {
  entityType: CommentRef["entityType"];
  entityId: string;
  body: string;
  bodyFormat?: CommentRef["bodyFormat"];
}

// ---------------------------------------------------------------------------
// Paginated result
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[];
  total?: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Sync primitives
// ---------------------------------------------------------------------------

/**
 * Opaque cursor representing the last-known sync position for a backend.
 * Each backend serialises whatever it needs (Graph deltaLink, GitHub etag,
 * SQLite rowid, Jira JQL updated-since timestamp, etc.).
 */
export interface SyncWatermark {
  backendId: string;
  /** ISO 8601 timestamp of when this watermark was captured. */
  timestamp: string;
  /** Backend-specific opaque cursor (e.g. Graph deltaLink URL). */
  cursor?: string;
  /** Backend-specific version tag (e.g. ETag header value). */
  etag?: string;
}

export interface ChangeSet {
  created: WorkspaceTask[];
  updated: Array<{ task: WorkspaceTask; changedFields: string[] }>;
  deleted: string[];
  watermark: SyncWatermark;
}

// ---------------------------------------------------------------------------
// Store capabilities
// ---------------------------------------------------------------------------

/**
 * Declares what a backend supports so the orchestration layer can adapt
 * behaviour without try/catch probing.
 */
export interface StoreCapabilities {
  /** Can operate without network connectivity. */
  supportsOffline: boolean;
  /** Supports watermark-based delta queries. */
  supportsDeltaQuery: boolean;
  /** Can receive push notifications for changes. */
  supportsWebhooks: boolean;
  /** Can send multiple mutations in a single request. */
  supportsBatchOperations: boolean;
  /** Supports rich-text / HTML content in descriptions and comments. */
  supportsRichText: boolean;
  /** Supports parent-child task relationships natively. */
  supportsHierarchy: boolean;
  /** Maximum items per page for list operations. */
  maxPageSize: number;
  /** Whether writes are immediately consistent or eventually consistent. */
  writeLatency: "immediate" | "eventual";
}

// ---------------------------------------------------------------------------
// Backend configuration
// ---------------------------------------------------------------------------

/**
 * Opaque per-backend configuration bag.
 * Each backend defines its own config shape (tenant IDs, site URLs, DB path,
 * API tokens, etc.). The registry passes this through without interpretation.
 */
export type BackendConfig = Record<string, unknown>;

// ---------------------------------------------------------------------------
// IssueStore interface
// ---------------------------------------------------------------------------

export interface IssueStore {
  /** Unique backend identifier, e.g. "ms-lists", "sqlite", "github". */
  readonly backendId: string;

  /** Declared capabilities for this backend. */
  readonly capabilities: StoreCapabilities;

  // -- Lifecycle ------------------------------------------------------------

  /** One-time initialisation (open connections, validate config, etc.). */
  initialize(config: BackendConfig): Promise<void>;

  /** Graceful shutdown (close connections, flush buffers). */
  dispose(): Promise<void>;

  // -- Read -----------------------------------------------------------------

  listTasks(query: TaskQuery): Promise<PaginatedResult<WorkspaceTask>>;
  getTask(id: string): Promise<WorkspaceTask | null>;

  listProjects(query: ProjectQuery): Promise<PaginatedResult<WorkspaceProject>>;
  getProject(id: string): Promise<WorkspaceProject | null>;

  listComments(entityId: string): Promise<CommentRef[]>;
  listPeople(): Promise<PersonRef[]>;

  // -- Write ----------------------------------------------------------------

  createTask(input: CreateTaskInput): Promise<WorkspaceTask>;
  updateTask(id: string, patch: TaskPatch): Promise<WorkspaceTask>;
  deleteTask(id: string): Promise<void>;

  createComment(input: CreateCommentInput): Promise<CommentRef>;

  // -- Sync support ---------------------------------------------------------

  /**
   * Return all changes since the given watermark.
   * Backends that don't support delta queries should throw or return
   * an empty changeset — the sync engine checks `capabilities.supportsDeltaQuery`.
   */
  getChangesSince(watermark: SyncWatermark): Promise<ChangeSet>;

  /** Return the current watermark (latest known position). */
  getWatermark(): Promise<SyncWatermark>;
}
