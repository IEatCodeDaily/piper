/**
 * InMemoryIssueStore — Reference IssueStore implementation backed by
 * in-memory maps. Useful for unit tests, UI development, and as a
 * template for new backend implementations.
 *
 * Does NOT support delta sync (capabilities.supportsDeltaQuery = false).
 */

import type { CommentRef } from "@/features/comments/types";
import type { PersonRef } from "@/features/people/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
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
} from "./types";

let nextId = 1;
function generateId(): string {
  return `mem-${nextId++}`;
}

export class InMemoryIssueStore implements IssueStore {
  readonly backendId = "in-memory";
  readonly capabilities: StoreCapabilities = {
    supportsOffline: true,
    supportsDeltaQuery: false,
    supportsWebhooks: false,
    supportsBatchOperations: false,
    supportsRichText: false,
    supportsHierarchy: true,
    maxPageSize: 1000,
    writeLatency: "immediate",
  };

  private tasks = new Map<string, WorkspaceTask>();
  private projects = new Map<string, WorkspaceProject>();
  private comments = new Map<string, CommentRef[]>(); // keyed by entityId
  private people = new Map<string, PersonRef>();
  private initialized = false;

  // -- Lifecycle ------------------------------------------------------------

  async initialize(_config: BackendConfig): Promise<void> {
    this.initialized = true;
  }

  async dispose(): Promise<void> {
    this.tasks.clear();
    this.projects.clear();
    this.comments.clear();
    this.people.clear();
    this.initialized = false;
  }

  // -- Seed helpers (for testing) -------------------------------------------

  seedTask(task: WorkspaceTask): void {
    this.tasks.set(task.id, task);
  }

  seedProject(project: WorkspaceProject): void {
    this.projects.set(project.id, project);
  }

  seedPerson(person: PersonRef): void {
    this.people.set(person.id, person);
  }

  seedComment(comment: CommentRef): void {
    const existing = this.comments.get(comment.entityId) ?? [];
    existing.push(comment);
    this.comments.set(comment.entityId, existing);
  }

  // -- Read -----------------------------------------------------------------

  async listTasks(query: TaskQuery): Promise<PaginatedResult<WorkspaceTask>> {
    let items = Array.from(this.tasks.values());

    if (query.projectId !== undefined) {
      items = items.filter((t) => t.projectId === query.projectId);
    }
    if (query.assigneeId !== undefined) {
      items = items.filter((t) => t.assignee?.id === query.assigneeId);
    }
    if (query.statuses !== undefined) {
      items = items.filter((t) => query.statuses!.includes(t.status));
    }
    if (query.parentTaskId !== undefined) {
      items = items.filter((t) => t.parentTaskId === query.parentTaskId);
    }
    if (query.labels !== undefined && query.labels.length > 0) {
      items = items.filter((t) =>
        query.labels!.some((label) => t.labels.includes(label)),
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
    const sortField = query.sortField ?? "sortOrder";
    const sortDir = query.sortDirection === "desc" ? -1 : 1;
    items.sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortField];
      const bVal = (b as Record<string, unknown>)[sortField];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * sortDir;
      }
      return String(aVal ?? "").localeCompare(String(bVal ?? "")) * sortDir;
    });

    // Paginate
    const offset = query.offset ?? 0;
    const limit = query.limit ?? this.capabilities.maxPageSize;
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
    return this.tasks.get(id) ?? null;
  }

  async listProjects(
    query: ProjectQuery,
  ): Promise<PaginatedResult<WorkspaceProject>> {
    let items = Array.from(this.projects.values());

    if (query.parentProjectId !== undefined) {
      items = items.filter((p) => p.parentProjectId === query.parentProjectId);
    }
    if (query.statuses !== undefined) {
      items = items.filter((p) => query.statuses!.includes(p.status));
    }
    if (!query.includeCompleted) {
      items = items.filter((p) => p.status !== "complete");
    }

    const offset = query.offset ?? 0;
    const limit = query.limit ?? this.capabilities.maxPageSize;
    const page = items.slice(offset, offset + limit);

    return {
      items: page,
      total: items.length,
      offset,
      limit,
      hasMore: offset + limit < items.length,
    };
  }

  async getProject(id: string): Promise<WorkspaceProject | null> {
    return this.projects.get(id) ?? null;
  }

  async listComments(entityId: string): Promise<CommentRef[]> {
    return this.comments.get(entityId) ?? [];
  }

  async listPeople(): Promise<PersonRef[]> {
    return Array.from(this.people.values());
  }

  // -- Write ----------------------------------------------------------------

  async createTask(input: CreateTaskInput): Promise<WorkspaceTask> {
    const now = new Date().toISOString();
    const id = generateId();

    const systemPerson: PersonRef = {
      id: "system",
      externalId: "system",
      displayName: "System",
      email: "system@local.invalid",
    };

    const task: WorkspaceTask = {
      id,
      externalId: id,
      workspaceId: "default",
      title: input.title,
      description: input.description ?? "",
      status: input.status ?? "backlog",
      priority: input.priority ?? "medium",
      projectId: input.projectId,
      parentTaskId: input.parentTaskId,
      assignee: input.assigneeId
        ? this.people.get(input.assigneeId) ?? {
            id: input.assigneeId,
            externalId: input.assigneeId,
            displayName: input.assigneeId,
            email: `${input.assigneeId}@local.invalid`,
          }
        : undefined,
      labels: input.labels ?? [],
      startDate: input.startDate,
      dueDate: input.dueDate,
      path: [input.title],
      sortOrder: this.tasks.size,
      watchers: [],
      checklist: [],
      attachments: [],
      commentIds: [],
      createdAt: now,
      updatedAt: now,
      createdBy: systemPerson,
      modifiedBy: systemPerson,
    };

    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, patch: TaskPatch): Promise<WorkspaceTask> {
    const existing = this.tasks.get(id);
    if (!existing) {
      throw new Error(`Task "${id}" not found.`);
    }

    const updated: WorkspaceTask = {
      ...existing,
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && {
        description: patch.description,
      }),
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.priority !== undefined && { priority: patch.priority }),
      ...(patch.projectId !== undefined && {
        projectId: patch.projectId ?? undefined,
      }),
      ...(patch.parentTaskId !== undefined && {
        parentTaskId: patch.parentTaskId ?? undefined,
      }),
      ...(patch.labels !== undefined && { labels: patch.labels }),
      ...(patch.startDate !== undefined && {
        startDate: patch.startDate ?? undefined,
      }),
      ...(patch.dueDate !== undefined && {
        dueDate: patch.dueDate ?? undefined,
      }),
      ...(patch.assigneeId !== undefined && {
        assignee: patch.assigneeId
          ? this.people.get(patch.assigneeId) ?? {
              id: patch.assigneeId,
              externalId: patch.assigneeId,
              displayName: patch.assigneeId,
              email: `${patch.assigneeId}@local.invalid`,
            }
          : undefined,
      }),
      updatedAt: new Date().toISOString(),
    };

    this.tasks.set(id, updated);
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.tasks.has(id)) {
      throw new Error(`Task "${id}" not found.`);
    }
    this.tasks.delete(id);
    this.comments.delete(id);
  }

  async createComment(input: CreateCommentInput): Promise<CommentRef> {
    const now = new Date().toISOString();
    const id = generateId();

    const comment: CommentRef = {
      id,
      externalId: id,
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body,
      bodyFormat: input.bodyFormat ?? "plain-text",
      author: {
        id: "system",
        externalId: "system",
        displayName: "System",
        email: "system@local.invalid",
      },
      createdAt: now,
      updatedAt: now,
      edited: false,
      mentions: [],
    };

    const existing = this.comments.get(input.entityId) ?? [];
    existing.push(comment);
    this.comments.set(input.entityId, existing);
    return comment;
  }

  // -- Sync support ---------------------------------------------------------

  async getChangesSince(_watermark: SyncWatermark): Promise<ChangeSet> {
    throw new Error(
      "InMemoryIssueStore does not support delta queries. Check capabilities.supportsDeltaQuery.",
    );
  }

  async getWatermark(): Promise<SyncWatermark> {
    return {
      backendId: this.backendId,
      timestamp: new Date().toISOString(),
    };
  }
}
