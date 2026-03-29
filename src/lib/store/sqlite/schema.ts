/**
 * SQLite Schema — Table definitions and migration engine for the local
 * SQLite issue store.
 *
 * Uses plain DDL (no ORM) for transparency. Migrations are numbered
 * sequentially and applied inside a transaction on initialisation.
 */

import type { Database } from "sql.js";

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

const CURRENT_VERSION = 1;

// ---------------------------------------------------------------------------
// Migration definitions
// ---------------------------------------------------------------------------

interface Migration {
  version: number;
  up: string[];
}

const migrations: Migration[] = [
  {
    version: 1,
    up: [
      // -- Projects ----------------------------------------------------------
      `CREATE TABLE IF NOT EXISTS projects (
        id              TEXT PRIMARY KEY,
        external_id     TEXT NOT NULL,
        workspace_id    TEXT NOT NULL DEFAULT 'default',
        project_code    TEXT NOT NULL DEFAULT '',
        title           TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'planned'
          CHECK(status IN ('planned','active','blocked','complete','on-hold')),
        health_status   TEXT NOT NULL DEFAULT 'on-track'
          CHECK(health_status IN ('on-track','at-risk','off-track','done')),
        health_summary  TEXT NOT NULL DEFAULT '',
        owner_id        TEXT NOT NULL DEFAULT 'system',
        start_date      TEXT,
        target_date     TEXT,
        completed_at    TEXT,
        priority        TEXT NOT NULL DEFAULT 'medium'
          CHECK(priority IN ('low','medium','high','urgent')),
        progress_percent INTEGER NOT NULL DEFAULT 0,
        labels          TEXT NOT NULL DEFAULT '[]',
        parent_project_id TEXT,
        path            TEXT NOT NULL DEFAULT '[]',
        created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,

      `CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`,

      // -- Tasks --------------------------------------------------------------
      `CREATE TABLE IF NOT EXISTS tasks (
        id              TEXT PRIMARY KEY,
        external_id     TEXT NOT NULL,
        workspace_id    TEXT NOT NULL DEFAULT 'default',
        title           TEXT NOT NULL,
        description     TEXT NOT NULL DEFAULT '',
        status          TEXT NOT NULL DEFAULT 'backlog'
          CHECK(status IN ('backlog','planned','in-progress','blocked','in-review','done')),
        priority        TEXT NOT NULL DEFAULT 'medium'
          CHECK(priority IN ('low','medium','high','urgent')),
        project_id      TEXT,
        parent_task_id  TEXT,
        assignee_id     TEXT,
        labels          TEXT NOT NULL DEFAULT '[]',
        start_date      TEXT,
        due_date        TEXT,
        completed_at    TEXT,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        path            TEXT NOT NULL DEFAULT '[]',
        created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        created_by      TEXT NOT NULL DEFAULT 'system',
        modified_by     TEXT NOT NULL DEFAULT 'system',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
        FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL
      )`,

      `CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id)`,
      `CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id)`,

      // -- Comments -----------------------------------------------------------
      `CREATE TABLE IF NOT EXISTS comments (
        id                TEXT PRIMARY KEY,
        external_id       TEXT NOT NULL,
        thread_id         TEXT,
        parent_comment_id TEXT,
        entity_type       TEXT NOT NULL CHECK(entity_type IN ('task','project')),
        entity_id         TEXT NOT NULL,
        body              TEXT NOT NULL DEFAULT '',
        body_format       TEXT NOT NULL DEFAULT 'plain-text'
          CHECK(body_format IN ('plain-text','markdown','html')),
        author_id         TEXT NOT NULL DEFAULT 'system',
        edited            INTEGER NOT NULL DEFAULT 0,
        created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
        updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,

      `CREATE INDEX IF NOT EXISTS idx_comments_entity ON comments(entity_type, entity_id)`,

      // -- People -------------------------------------------------------------
      `CREATE TABLE IF NOT EXISTS people (
        id            TEXT PRIMARY KEY,
        external_id   TEXT NOT NULL,
        display_name  TEXT NOT NULL,
        email         TEXT NOT NULL,
        job_title     TEXT,
        department    TEXT,
        avatar_url    TEXT,
        presence      TEXT
          CHECK(presence IS NULL OR presence IN ('online','busy','away','offline'))
      )`,

      // -- Schema version tracking --------------------------------------------
      `CREATE TABLE IF NOT EXISTS schema_version (
        version     INTEGER PRIMARY KEY,
        applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
      )`,

      // NOTE: FTS5 virtual table is created conditionally in runMigrations()
      // because the default sql.js WASM build may not include FTS5.
    ],
  },
];

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

/**
 * Run all pending migrations inside a transaction.
 * Safe to call on every boot — already-applied migrations are skipped.
 */
export function runMigrations(db: Database): void {
  // Create schema_version table if it doesn't exist (idempotent)
  db.run(
    `CREATE TABLE IF NOT EXISTS schema_version (
      version     INTEGER PRIMARY KEY,
      applied_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`,
  );

  // Read current version
  const currentRow = db.exec(
    "SELECT COALESCE(MAX(version), 0) AS v FROM schema_version",
  );
  const currentVersion =
    currentRow.length > 0 && currentRow[0].values.length > 0
      ? (currentRow[0].values[0][0] as number)
      : 0;

  const pending = migrations.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  db.exec("BEGIN TRANSACTION");
  try {
    for (const migration of pending) {
      for (const stmt of migration.up) {
        db.run(stmt);
      }
      db.run("INSERT INTO schema_version (version) VALUES (?)", [
        migration.version,
      ]);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw new Error(
      `SQLite migration failed at version ${currentVersion}: ${err}`,
    );
  }
}

export { CURRENT_VERSION };

/**
 * Attempt to create FTS5 virtual table + triggers.
 * Returns true if FTS5 is available, false otherwise.
 */
export function tryCreateFts5(db: Database): boolean {
  try {
    db.run(
      `CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
        title, description, content=tasks, content_rowid=rowid, tokenize='unicode61'
      )`,
    );
    db.run(
      `CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
        INSERT INTO tasks_fts(rowid, title, description)
        VALUES (new.rowid, new.title, new.description);
      END`,
    );
    db.run(
      `CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, description)
        VALUES ('delete', old.rowid, old.title, old.description);
      END`,
    );
    db.run(
      `CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
        INSERT INTO tasks_fts(tasks_fts, rowid, title, description)
        VALUES ('delete', old.rowid, old.title, old.description);
        INSERT INTO tasks_fts(rowid, title, description)
        VALUES (new.rowid, new.title, new.description);
      END`,
    );
    return true;
  } catch {
    return false;
  }
}
