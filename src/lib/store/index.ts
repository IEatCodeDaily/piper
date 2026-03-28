/**
 * Piper Store — Backend-agnostic adapter layer.
 *
 * Public surface:
 *   - IssueStore      — uniform CRUD + query + sync for any backend
 *   - SchemaMapper     — bidirectional field translation
 *   - AuthProvider     — pluggable per-backend authentication
 *   - BackendRegistry  — runtime adapter discovery and instantiation
 *   - IssueSync        — bidirectional delta sync engine
 */

// Core store interface and types
export type {
  IssueStore,
  StoreCapabilities,
  BackendConfig,
  TaskQuery,
  ProjectQuery,
  CreateTaskInput,
  TaskPatch,
  CreateCommentInput,
  PaginatedResult,
  SyncWatermark,
  ChangeSet,
} from "./types";

// Schema mapping
export type {
  SchemaMapper,
  FieldMappingConfig,
  FieldMapping,
  FieldTransform,
  RendererMapping,
  RelationMapping,
  MappingContext,
  ValidationResult,
  ValidationIssue,
} from "./schema-mapper";

// Authentication
export type {
  AuthProvider,
  AuthCredential,
  AuthState,
  AuthType,
  AuthConfig,
  Disposable,
} from "./auth-provider";

// Backend registry
export type { BackendFactory, BackendRegistry } from "./backend-registry";
export { createBackendRegistry } from "./backend-registry";

// Repository bridge
export { IssueStoreRepository } from "./issue-store-repository";
export type { IssueStoreRepositoryConfig } from "./issue-store-repository";

// Concrete implementations
export { InMemoryIssueStore } from "./in-memory-issue-store";
export { NoopAuthProvider } from "./noop-auth-provider";

// Sync engine
export type {
  IssueSync,
  SyncOptions,
  SyncDirection,
  SyncResult,
  SyncError,
  SyncSubscription,
  ConflictStrategy,
  ConflictRecord,
  ConflictResolution,
  ConflictHandler,
  RetryPolicy,
} from "./issue-sync";
