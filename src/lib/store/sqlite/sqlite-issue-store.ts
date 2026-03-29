/**
 * SQLiteIssueStore — Local-first IssueStore backed by SQLite (via sql.js).
 *
 * Full CRUD on tasks, projects, comments, and people with:
 *   - Full-text search via FTS5
 *   - Schema versioning via migration engine
 *   - Delta sync support via rowid watermarking
 *   - Works fully offline
 */

import type { CommentRef } from "@/features/comments/types";
import type { PersonRef } from "@/features/people/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import initSqlJs, { type Database } from "sql.js";
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
import { runMigrations, tryCreateFts5 } from "./schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let idCounter = 0;
function generateId(): string {
  return `local-${Date.now().toString(36)}-${(++idCounter).toString(36)}`;
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function rowToPerson(row: Record<string, unknown>): PersonRef {
  return {
    id: row.id as string,
    externalId: row.external_id as string,
    displayName: row.display_name as string,
    email: row.email as string,
    jobTitle: (row.job_title as string) || undefined,
    department: (row.department as string) || undefined,
    avatarUrl: (row.avatar_url as string) || undefined,
    presence: (row.presence as PersonRef["presence"]) || undefined,
  };
}

function getPerson(db: Database, personId: string): PersonRef {
  const results = db.exec(
    "SELECT id, external_id, display_name, email, job_title, department, avatar_url, presence FROM people WHERE id = ?",
    [personId],
  );
  if (results.length > 0 && results[0].values.length > 0) {
    const cols = results[0].columns;
    const vals = results[0].values[0];
    const row: Record<string, unknown> = {};
    cols.forEach((c, i) => (row[c] = vals[i]));
    return rowToPerson(row);
  }
  return {
    id: personId,
    externalId: personId,
    displayName: personId,
    email: `${personId}@local.invalid`,
  };
}

function rowToTask(db: Database, row: Record<string, unknown>): WorkspaceTask {
  const assigneeId = row.assignee_id as string | null;
  const createdBy = row.created_by as string;
  const modifiedBy = row.modified_by as string;

  return {
    id: row.id as string,
    externalId: row.external_id as string,
    workspaceId: row.workspace_id as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as WorkspaceTask["status"],
    priority: row.priority as WorkspaceTask["priority"],
    projectId: (row.project_id as string) || undefined,
    parentTaskId: (row.parent_task_id as string) || undefined,
    assignee: assigneeId ? getPerson(db, assigneeId) : undefined,
    labels: parseJson<string[]>(row.labels as string, []),
    startDate: (row.start_date as string) || undefined,
    dueDate: (row.due_date as string) || undefined,
    completedAt: (row.completed_at as string) || undefined,
    path: parseJson<string[]>(row.path as string, []),
    sortOrder: row.sort_order as number,
    watchers: [],
    checklist: [],
    attachments: [],
    commentIds: [],
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    createdBy: getPerson(db, createdBy),
    modifiedBy: getPerson(db, modifiedBy),
  };
}

function rowToProject(row: Record<string, unknown>): WorkspaceProject {
  return {
    id: row.id as string,
    externalId: row.external_id as string,
    workspaceId: row.workspace_id as string,
    projectCode: row.project_code as string,
    title: row.title as string,
    description: row.description as string,
    status: row.status as WorkspaceProject["status"],
    health: {
      status: row.health_status as "on-track" | "at-risk" | "off-track" | "done",
      summary: row.health_summary as string,
    },
    owner: {
      id: row.owner_id as string,
      externalId: row.owner_id as string,
      displayName: row.owner_id as string,
      email: `${row.owner_id}@local.invalid`,
    },
    collaborators: [],
    startDate: (row.start_date as string) || undefined,
    targetDate: (row.target_date as string) || undefined,
    completedAt: (row.completed_at as string) || undefined,
    priority: row.priority as WorkspaceProject["priority"],
    progressPercent: row.progress_percent as number,
    labels: parseJson<string[]>(row.labels as string, []),
    parentProjectId: (row.parent_project_id as string) || undefined,
    path: parseJson<string[]>(row.path as string, []),
    milestoneIds: [],
    milestones: [],
    taskIds: [],
    taskCount: 0,
    openTaskCount: 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function queryRows(
  db: Database,
  sql: string,
  params?: unknown[],
): Record<string, unknown>[] {
  const results = db.exec(sql, params);
  if (results.length === 0 || results[0].values.length === 0) return [];
  const cols = results[0].columns;
  return results[0].values.map((vals) => {
    const row: Record<string, unknown> = {};
    cols.forEach((c, i) => (row[c] = vals[i]));
    return row;
  });
}

// ---------------------------------------------------------------------------
// SQLiteIssueStore
// ---------------------------------------------------------------------------

export class SQLiteIssueStore implements IssueStore {
  readonly backendId = "sqlite";
  readonly capabilities: StoreCapabilities = {
    supportsOffline: true,
    supportsDeltaQuery: true,
    supportsWebhooks: false,
    supportsBatchOperations: true,
    supportsRichText: true,
    supportsHierarchy: true,
    maxPageSize: 500,
    writeLatency: "immediate",
  };

  private db: Database | null = null;
  private dbPath: string | null = null;

  // -- Lifecycle ------------------------------------------------------------

  private fts5Available = false;

  async initialize(config: BackendConfig): Promise<void> {
    const SQL = await initSqlJs();
    this.db = new SQL.Database();
    this.dbPath = (config.dbPath as string) ?? ":memory:";

    // Enable WAL mode and foreign keys
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");

    // Run migrations
    runMigrations(this.db);

    // Attempt FTS5 setup (may not be supported by the WASM build)
    this.fts5Available = tryCreateFts5(this.db);
  }

  async dispose(): Promise<void> {
    this.db?.close();
    this.db = null;
  }

  /** Expose the raw Database for testing / advanced use. */
  getDatabase(): Database | null {
    return this.db;
  }

  // -- Read: Tasks ----------------------------------------------------------

  async listTasks(query: TaskQuery): Promise<PaginatedResult<WorkspaceTask>> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");

    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];

    if (query.projectId !== undefined) {
      conditions.push("t.project_id = ?");
      params.push(query.projectId);
    }
    if (query.assigneeId !== undefined) {
      conditions.push("t.assignee_id = ?");
      params.push(query.assigneeId);
    }
    if (query.statuses !== undefined && query.statuses.length > 0) {
      const placeholders = query.statuses.map(() => "?").join(",");
      conditions.push(`t.status IN (${placeholders})`);
      params.push(...query.statuses);
    } else if (!query.includeCompleted) {
      conditions.push("t.status != 'done'");
    }

    if (query.parentTaskId !== undefined) {
      conditions.push("t.parent_task_id = ?");
      params.push(query.parentTaskId);
    }

    // Label filter (JSON array contains)
    if (query.labels && query.labels.length > 0) {
      const labelConditions = query.labels.map((label) => {
        params.push(`%"${label}"%`);
        return `t.labels LIKE ?`;
      });
      conditions.push(`(${labelConditions.join(" OR ")})`);
    }

    // Full-text search
    let ftsJoin = "";
    if (query.search) {
      if (this.fts5Available) {
        ftsJoin = `INNER JOIN tasks_fts fts ON fts.rowid = t.rowid`;
        conditions.push("tasks_fts MATCH ?");
        params.push(query.search);
      } else {
        // Fallback to LIKE when FTS5 is not available
        conditions.push("(t.title LIKE ? OR t.description LIKE ?)");
        params.push(`%${query.search}%`, `%${query.search}%`);
      }
    }

    const where = conditions.join(" AND ");

    // Count total
    const countSql = `SELECT COUNT(*) AS cnt FROM tasks t ${ftsJoin} WHERE ${where}`;
    const countRows = queryRows(this.db, countSql, params);
    const total = countRows.length > 0 ? (countRows[0].cnt as number) : 0;

    // Sort
    const sortField = query.sortField ?? "sort_order";
    const sortDir = query.sortDirection === "desc" ? "DESC" : "ASC";
    // Whitelist sortable columns to prevent injection
    const allowedSortFields = new Set([
      "sort_order",
      "title",
      "status",
      "priority",
      "created_at",
      "updated_at",
      "start_date",
      "due_date",
    ]);
    const safeSort = allowedSortFields.has(sortField) ? sortField : "sort_order";
    const order = `ORDER BY t.${safeSort} ${sortDir}`;

    // Paginate
    const offset = query.offset ?? 0;
    const limit = query.limit ?? this.capabilities.maxPageSize;
    params.push(limit, offset);

    const dataSql = `SELECT t.* FROM tasks t ${ftsJoin} WHERE ${where} ${order} LIMIT ? OFFSET ?`;
    const rows = queryRows(this.db, dataSql, params);

    const items = rows.map((row) => rowToTask(this.db!, row));

    return {
      items,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  }

  async getTask(id: string): Promise<WorkspaceTask | null> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");
    const rows = queryRows(this.db, "SELECT * FROM tasks WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    return rowToTask(this.db, rows[0]);
  }

  // -- Read: Projects -------------------------------------------------------

  async listProjects(
    query: ProjectQuery,
  ): Promise<PaginatedResult<WorkspaceProject>> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");

    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];

    if (query.parentProjectId !== undefined) {
      conditions.push("parent_project_id = ?");
      params.push(query.parentProjectId);
    }
    if (query.statuses !== undefined && query.statuses.length > 0) {
      const placeholders = query.statuses.map(() => "?").join(",");
      conditions.push(`status IN (${placeholders})`);
      params.push(...query.statuses);
    }
    if (!query.includeCompleted) {
      conditions.push("status != 'complete'");
    }

    const where = conditions.join(" AND ");

    const countRows = queryRows(
      this.db,
      `SELECT COUNT(*) AS cnt FROM projects WHERE ${where}`,
      params,
    );
    const total = countRows.length > 0 ? (countRows[0].cnt as number) : 0;

    const offset = query.offset ?? 0;
    const limit = query.limit ?? this.capabilities.maxPageSize;
    params.push(limit, offset);

    const rows = queryRows(
      this.db,
      `SELECT * FROM projects WHERE ${where} ORDER BY title ASC LIMIT ? OFFSET ?`,
      params,
    );

    return {
      items: rows.map(rowToProject),
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
    };
  }

  async getProject(id: string): Promise<WorkspaceProject | null> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");
    const rows = queryRows(
      this.db,
      "SELECT * FROM projects WHERE id = ?",
      [id],
    );
    if (rows.length === 0) return null;
    return rowToProject(rows[0]);
  }

  // -- Read: Comments -------------------------------------------------------

  async listComments(entityId: string): Promise<CommentRef[]> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");
    const rows = queryRows(
      this.db,
      "SELECT * FROM comments WHERE entity_id = ? ORDER BY created_at ASC",
      [entityId],
    );

    return rows.map((row) => {
      const authorId = row.author_id as string;
      return {
        id: row.id as string,
        externalId: row.external_id as string,
        threadId: (row.thread_id as string) || undefined,
        parentCommentId: (row.parent_comment_id as string) || undefined,
        entityType: row.entity_type as "task" | "project",
        entityId: row.entity_id as string,
        body: row.body as string,
        bodyFormat: row.body_format as CommentRef["bodyFormat"],
        author: getPerson(this.db!, authorId),
        createdAt: row.created_at as string,
        updatedAt: (row.updated_at as string) || undefined,
        edited: (row.edited as number) === 1,
        mentions: [],
      };
    });
  }

  // -- Read: People ---------------------------------------------------------

  async listPeople(): Promise<PersonRef[]> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");
    const rows = queryRows(this.db, "SELECT * FROM people ORDER BY display_name ASC");
    return rows.map(rowToPerson);
  }

  // -- Write: Tasks ---------------------------------------------------------

  async createTask(input: CreateTaskInput): Promise<WorkspaceTask> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");

    const id = generateId();
    const now = new Date().toISOString();

    // Ensure person exists if assigneeId given
    if (input.assigneeId) {
      this.ensurePerson(input.assigneeId);
    }

    const systemId = "system";
    this.ensurePerson(systemId);

    this.db.run(
      `INSERT INTO tasks (id, external_id, workspace_id, title, description, status, priority,
        project_id, parent_task_id, assignee_id, labels, start_date, due_date, sort_order, path,
        created_at, updated_at, created_by, modified_by)
       VALUES (?, ?, 'default', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks),
        ?, ?, ?, ?, ?)`,
      [
        id,
        id,
        input.title,
        input.description ?? "",
        input.status ?? "backlog",
        input.priority ?? "medium",
        input.projectId ?? null,
        input.parentTaskId ?? null,
        input.assigneeId ?? null,
        JSON.stringify(input.labels ?? []),
        input.startDate ?? null,
        input.dueDate ?? null,
        JSON.stringify([input.title]),
        now,
        now,
        systemId,
        systemId,
      ],
    );

    return (await this.getTask(id))!;
  }

  async updateTask(id: string, patch: TaskPatch): Promise<WorkspaceTask> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");

    const existing = await this.getTask(id);
    if (!existing) throw new Error(`Task "${id}" not found.`);

    const sets: string[] = [];
    const params: unknown[] = [];

    if (patch.title !== undefined) {
      sets.push("title = ?");
      params.push(patch.title);
    }
    if (patch.description !== undefined) {
      sets.push("description = ?");
      params.push(patch.description);
    }
    if (patch.status !== undefined) {
      sets.push("status = ?");
      params.push(patch.status);
      if (patch.status === "done") {
        sets.push("completed_at = ?");
        params.push(new Date().toISOString());
      }
    }
    if (patch.priority !== undefined) {
      sets.push("priority = ?");
      params.push(patch.priority);
    }
    if (patch.projectId !== undefined) {
      sets.push("project_id = ?");
      params.push(patch.projectId ?? null);
    }
    if (patch.parentTaskId !== undefined) {
      sets.push("parent_task_id = ?");
      params.push(patch.parentTaskId ?? null);
    }
    if (patch.labels !== undefined) {
      sets.push("labels = ?");
      params.push(JSON.stringify(patch.labels));
    }
    if (patch.startDate !== undefined) {
      sets.push("start_date = ?");
      params.push(patch.startDate ?? null);
    }
    if (patch.dueDate !== undefined) {
      sets.push("due_date = ?");
      params.push(patch.dueDate ?? null);
    }
    if (patch.assigneeId !== undefined) {
      sets.push("assignee_id = ?");
      params.push(patch.assigneeId ?? null);
      if (patch.assigneeId) this.ensurePerson(patch.assigneeId);
    }

    sets.push("updated_at = ?");
    params.push(new Date().toISOString());

    params.push(id);
    this.db.run(
      `UPDATE tasks SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );

    return (await this.getTask(id))!;
  }

  async deleteTask(id: string): Promise<void> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");
    const existing = await this.getTask(id);
    if (!existing) throw new Error(`Task "${id}" not found.`);

    // Delete comments first
    this.db.run("DELETE FROM comments WHERE entity_id = ?", [id]);
    // Delete task
    this.db.run("DELETE FROM tasks WHERE id = ?", [id]);
  }

  // -- Write: Comments ------------------------------------------------------

  async createComment(input: CreateCommentInput): Promise<CommentRef> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");

    const id = generateId();
    const now = new Date().toISOString();
    const systemId = "system";
    this.ensurePerson(systemId);

    this.db.run(
      `INSERT INTO comments (id, external_id, entity_type, entity_id, body, body_format, author_id, created_at, updated_at, edited)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [id, id, input.entityType, input.entityId, input.body, input.bodyFormat ?? "plain-text", systemId, now, now],
    );

    return {
      id,
      externalId: id,
      entityType: input.entityType,
      entityId: input.entityId,
      body: input.body,
      bodyFormat: input.bodyFormat ?? "plain-text",
      author: getPerson(this.db, systemId),
      createdAt: now,
      updatedAt: now,
      edited: false,
      mentions: [],
    };
  }

  // -- Sync support ---------------------------------------------------------

  async getChangesSince(watermark: SyncWatermark): Promise<ChangeSet> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");

    const cursor = watermark.cursor;
    const sinceTime = watermark.timestamp;

    // Created / updated tasks since watermark
    const updatedRows = queryRows(
      this.db,
      "SELECT * FROM tasks WHERE updated_at > ? ORDER BY updated_at ASC",
      [sinceTime],
    );

    const created: WorkspaceTask[] = [];
    const updated: Array<{ task: WorkspaceTask; changedFields: string[] }> = [];

    for (const row of updatedRows) {
      const task = rowToTask(this.db, row);
      if (task.createdAt > sinceTime) {
        created.push(task);
      } else {
        updated.push({ task, changedFields: ["*"] });
      }
    }

    return {
      created,
      updated,
      deleted: [],
      watermark: await this.getWatermark(),
    };
  }

  async getWatermark(): Promise<SyncWatermark> {
    if (!this.db) throw new Error("SQLiteIssueStore not initialised.");

    const rows = queryRows(
      this.db,
      "SELECT MAX(updated_at) AS latest FROM tasks",
    );
    // Use an early epoch when no tasks exist so any new task is detected
    const timestamp =
      rows.length > 0 && rows[0].latest
        ? (rows[0].latest as string)
        : "1970-01-01T00:00:00.000Z";

    return {
      backendId: this.backendId,
      timestamp,
      cursor: timestamp,
    };
  }

  // -- Internal helpers -----------------------------------------------------

  private ensurePerson(personId: string): void {
    if (!this.db) return;
    const existing = queryRows(
      this.db,
      "SELECT id FROM people WHERE id = ?",
      [personId],
    );
    if (existing.length === 0) {
      this.db.run(
        `INSERT OR IGNORE INTO people (id, external_id, display_name, email)
         VALUES (?, ?, ?, ?)`,
        [personId, personId, personId, `${personId}@local.invalid`],
      );
    }
  }
}
