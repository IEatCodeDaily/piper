/**
 * SchemaMapper — Bidirectional field translation between Piper's unified
 * schema and a backend's native schema.
 *
 * Each backend provides its own SchemaMapper implementation. The mapper is
 * configured by workspace-level field mappings so that column/field names
 * never appear in core Piper source code.
 */

import type { CommentRef } from "@/features/comments/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { WorkspaceFieldDataType } from "@/features/workspaces/types";
import type { CreateCommentInput, CreateTaskInput, TaskPatch } from "./types";

// ---------------------------------------------------------------------------
// Field mapping configuration
// ---------------------------------------------------------------------------

export interface FieldTransform {
  /** Optional value map for enum-like fields (e.g. status normalisation). */
  valueMap?: Record<string, string>;
  /** Fallback value when the source field is empty/missing. */
  defaultValue?: unknown;
}

export interface FieldMapping {
  /** The backend-native field name (column name, JSON key, etc.). */
  sourceField: string;
  /** Piper's semantic data type for this field. */
  dataType: WorkspaceFieldDataType;
  /** Whether the field must be present. */
  required?: boolean;
  /** Whether the field is writable. */
  editable?: boolean;
  /** Optional transformation rules. */
  transform?: FieldTransform;
}

export interface RendererMapping {
  /** Renderer kind used by the UI for this field. */
  kind: string;
  /** Additional renderer-specific options. */
  options?: Record<string, unknown>;
}

export interface RelationMapping {
  /** The target entity scope for this relation (e.g. "projects", "tasks"). */
  targetScope: string;
  /** The backend-native field that holds the foreign key/reference. */
  sourceField: string;
  /** The target list/table identifier. */
  targetListId?: string;
}

export interface FieldMappingConfig {
  fields: Record<string, FieldMapping>;
  renderers: Record<string, RendererMapping>;
  relations: Record<string, RelationMapping>;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

// ---------------------------------------------------------------------------
// Mapping context
// ---------------------------------------------------------------------------

/** Extra context that may be needed during mapping (e.g. list IDs). */
export interface MappingContext {
  listId?: string;
  itemId?: string;
  entityType?: CommentRef["entityType"];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// SchemaMapper interface
// ---------------------------------------------------------------------------

/**
 * `TBackendItem` is the raw item shape coming from the backend
 * (e.g. `GraphListItem` for MS Lists, a GitHub Issue JSON, etc.).
 */
export interface SchemaMapper<TBackendItem = unknown> {
  /** Must match the companion IssueStore's backendId. */
  readonly backendId: string;

  // -- Backend → Piper ------------------------------------------------------

  toTask(backendItem: TBackendItem, config: FieldMappingConfig): WorkspaceTask;
  toProject(backendItem: TBackendItem, config: FieldMappingConfig): WorkspaceProject;
  toComment(backendItem: unknown, context: MappingContext): CommentRef;

  // -- Piper → Backend ------------------------------------------------------

  fromTaskPatch(patch: TaskPatch, config: FieldMappingConfig): Partial<TBackendItem>;
  fromCreateTask(input: CreateTaskInput, config: FieldMappingConfig): TBackendItem;
  fromCreateComment(input: CreateCommentInput): unknown;

  // -- Validation -----------------------------------------------------------

  /**
   * Validate that the field mapping config is compatible with the
   * backend's actual schema (column definitions, field types, etc.).
   */
  validateConfig(
    config: FieldMappingConfig,
    backendSchema: unknown,
  ): ValidationResult;
}
