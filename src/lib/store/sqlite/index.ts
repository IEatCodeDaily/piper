/**
 * SQLite adapter — Local-first SQLite backend for Piper.
 *
 * Exports the full adapter stack:
 *   - SQLiteIssueStore  — IssueStore implementation
 *   - SQLiteSchemaMapper — Identity schema mapper
 *   - sqliteFactory     — BackendFactory for the registry
 */

export { SQLiteIssueStore } from "./sqlite-issue-store";
export { SQLiteSchemaMapper } from "./sqlite-schema-mapper";
export { runMigrations, CURRENT_VERSION } from "./schema";

import type { AuthConfig, AuthProvider } from "../auth-provider";
import { NoopAuthProvider } from "../noop-auth-provider";
import type { BackendConfig, IssueStore } from "../types";
import type { BackendFactory, FieldMappingConfig, SchemaMapper } from "../schema-mapper";
import { SQLiteIssueStore } from "./sqlite-issue-store";
import { SQLiteSchemaMapper } from "./sqlite-schema-mapper";

/**
 * Factory for creating the SQLite adapter stack.
 *
 * Usage:
 * ```ts
 * const registry = createBackendRegistry();
 * registry.register("sqlite", sqliteFactory);
 * ```
 */
export const sqliteFactory: BackendFactory = {
  createStore(_config: BackendConfig): IssueStore {
    return new SQLiteIssueStore();
  },

  createMapper(_config: FieldMappingConfig): SchemaMapper {
    return new SQLiteSchemaMapper();
  },

  createAuthProvider(_config: AuthConfig): AuthProvider {
    return new NoopAuthProvider("sqlite");
  },
};
