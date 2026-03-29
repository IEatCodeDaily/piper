/**
 * SQLiteSchemaMapper — Identity mapper for the local SQLite backend.
 *
 * Since SQLite stores data in Piper-native format, no field translation
 * is needed. This mapper passes values through unchanged.
 */

import type { CommentRef } from "@/features/comments/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { CreateCommentInput, CreateTaskInput, TaskPatch } from "../types";
import type {
  FieldMappingConfig,
  MappingContext,
  SchemaMapper,
  ValidationResult,
} from "../schema-mapper";

export class SQLiteSchemaMapper implements SchemaMapper {
  readonly backendId = "sqlite";

  // -- Backend → Piper (identity) -------------------------------------------

  toTask(backendItem: unknown, _config: FieldMappingConfig): WorkspaceTask {
    return backendItem as WorkspaceTask;
  }

  toProject(backendItem: unknown, _config: FieldMappingConfig): WorkspaceProject {
    return backendItem as WorkspaceProject;
  }

  toComment(backendItem: unknown, _context: MappingContext): CommentRef {
    return backendItem as CommentRef;
  }

  // -- Piper → Backend (identity) -------------------------------------------

  fromTaskPatch(patch: TaskPatch, _config: FieldMappingConfig): Partial<TaskPatch> {
    return patch;
  }

  fromCreateTask(input: CreateTaskInput, _config: FieldMappingConfig): CreateTaskInput {
    return input;
  }

  fromCreateComment(input: CreateCommentInput): unknown {
    return input;
  }

  // -- Validation ------------------------------------------------------------

  validateConfig(_config: FieldMappingConfig, _backendSchema?: unknown): ValidationResult {
    // SQLite backend uses identity mapping; any config is valid.
    return { valid: true, issues: [] };
  }
}
