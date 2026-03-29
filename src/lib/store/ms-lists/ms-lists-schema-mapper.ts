/**
 * MsListsSchemaMapper — SchemaMapper implementation for Microsoft Lists.
 *
 * Delegates to the existing mapper functions in piper-graph-adapter.ts
 * and wraps them in the SchemaMapper interface. This is the Phase 1
 * migration path: same logic, clean interface boundary.
 */

import type { CommentRef } from "@/features/comments/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { WorkspaceConfig } from "@/features/workspaces/types";
import type { GraphListColumnDefinition, GraphListItem } from "@/lib/graph/types";
import {
  mapGraphListCommentToCommentRef,
  mapGraphListItemToWorkspaceProject,
  mapGraphListItemToWorkspaceTask,
} from "@/lib/graph/piper-graph-adapter";
import type {
  FieldMappingConfig,
  MappingContext,
  SchemaMapper,
  ValidationIssue,
  ValidationResult,
} from "../schema-mapper";
import type { CreateCommentInput, CreateTaskInput, TaskPatch } from "../types";

/**
 * Convert a FieldMappingConfig + workspace metadata into the WorkspaceConfig
 * shape that the existing graph adapter functions expect.
 *
 * This is the bridge between the new SchemaMapper interface and the existing
 * mapper functions. Once the adapter functions are fully migrated to use
 * FieldMappingConfig directly, this bridge can be removed.
 */
function toWorkspaceConfig(
  config: FieldMappingConfig,
  context: MsListsMapperContext,
): WorkspaceConfig {
  return context.workspaceConfig;
}

export interface MsListsMapperContext {
  /** The full workspace config (existing format). */
  workspaceConfig: WorkspaceConfig;
}

export class MsListsSchemaMapper implements SchemaMapper<GraphListItem> {
  readonly backendId = "ms-lists";

  private readonly context: MsListsMapperContext;

  constructor(context: MsListsMapperContext) {
    this.context = context;
  }

  // -- Backend → Piper ------------------------------------------------------

  toTask(
    backendItem: GraphListItem,
    _config: FieldMappingConfig,
  ): WorkspaceTask {
    return mapGraphListItemToWorkspaceTask({
      workspaceConfig: this.context.workspaceConfig,
      item: backendItem,
    });
  }

  toProject(
    backendItem: GraphListItem,
    _config: FieldMappingConfig,
  ): WorkspaceProject {
    return mapGraphListItemToWorkspaceProject({
      workspaceConfig: this.context.workspaceConfig,
      item: backendItem,
    });
  }

  toComment(backendItem: unknown, context: MappingContext): CommentRef {
    return mapGraphListCommentToCommentRef({
      workspaceConfig: this.context.workspaceConfig,
      listId: context.listId as string,
      itemId: context.itemId as string,
      entityType: (context.entityType as CommentRef["entityType"]) ?? "task",
      graphComment: backendItem as Parameters<
        typeof mapGraphListCommentToCommentRef
      >[0]["graphComment"],
    });
  }

  // -- Piper → Backend ------------------------------------------------------

  fromTaskPatch(
    patch: TaskPatch,
    config: FieldMappingConfig,
  ): Partial<GraphListItem> {
    const fields: Record<string, unknown> = {};

    for (const [semanticField, fieldMapping] of Object.entries(config.fields)) {
      const value = mapPiperFieldToGraphField(semanticField, patch);
      if (value !== undefined) {
        fields[fieldMapping.sourceField] = value;
      }
    }

    return { fields } as Partial<GraphListItem>;
  }

  fromCreateTask(
    input: CreateTaskInput,
    config: FieldMappingConfig,
  ): GraphListItem {
    const fields: Record<string, unknown> = {};

    // Map each semantic field from the create input
    const semanticValues: Record<string, unknown> = {
      title: input.title,
      description: input.description,
      status: input.status ? denormaliseTaskStatus(input.status) : "Not Started",
      priority: input.priority ? denormaliseTaskPriority(input.priority) : "Medium",
      startDate: input.startDate,
      dueDate: input.dueDate,
      labels: input.labels,
    };

    for (const [semanticField, fieldMapping] of Object.entries(config.fields)) {
      const value = semanticValues[semanticField];
      if (value !== undefined) {
        fields[fieldMapping.sourceField] = value;
      }
    }

    return {
      id: "",
      createdDateTime: new Date().toISOString(),
      lastModifiedDateTime: new Date().toISOString(),
      createdBy: {},
      lastModifiedBy: {},
      fields,
    } as unknown as GraphListItem;
  }

  fromCreateComment(input: CreateCommentInput): unknown {
    return {
      body: {
        content: input.body,
        contentType: input.bodyFormat === "html" ? "html" : "text",
      },
    };
  }

  // -- Validation -----------------------------------------------------------

  validateConfig(
    config: FieldMappingConfig,
    backendSchema: unknown,
  ): ValidationResult {
    const columns = backendSchema as GraphListColumnDefinition[];
    const issues: ValidationIssue[] = [];
    const columnNames = new Set(columns.map((c) => c.name));

    // Check that all mapped source fields actually exist in the backend
    for (const [semanticField, fieldMapping] of Object.entries(config.fields)) {
      if (!columnNames.has(fieldMapping.sourceField)) {
        issues.push({
          field: semanticField,
          message: `Source field "${fieldMapping.sourceField}" does not exist in the MS Lists column definitions.`,
          severity: "error",
        });
      }
    }

    // Check for required Piper fields that aren't mapped
    const requiredFields = ["title", "status"];
    for (const required of requiredFields) {
      if (!config.fields[required]) {
        issues.push({
          field: required,
          message: `Required semantic field "${required}" is not mapped.`,
          severity: "error",
        });
      }
    }

    // Check data type compatibility
    for (const [semanticField, fieldMapping] of Object.entries(config.fields)) {
      const column = columns.find((c) => c.name === fieldMapping.sourceField);
      if (!column) continue;

      const compatible = isTypeCompatible(fieldMapping.dataType, column.dataType);
      if (!compatible) {
        issues.push({
          field: semanticField,
          message: `Data type mismatch: Piper type "${fieldMapping.dataType}" is not compatible with Graph column type "${column.dataType}" for column "${column.name}".`,
          severity: "warning",
        });
      }
    }

    return {
      valid: issues.every((i) => i.severity !== "error"),
      issues,
    };
  }
}

// ---------------------------------------------------------------------------
// Type coercion helpers
// ---------------------------------------------------------------------------

/**
 * Denormalise a Piper task status back to the MS Lists choice column value.
 */
function denormaliseTaskStatus(status: WorkspaceTask["status"]): string {
  switch (status) {
    case "backlog":
      return "Backlog";
    case "planned":
      return "Not Started";
    case "in-progress":
      return "In Progress";
    case "blocked":
      return "Blocked";
    case "in-review":
      return "In Review";
    case "done":
      return "Done";
    default:
      return "Backlog";
  }
}

/**
 * Denormalise a Piper task priority back to the MS Lists choice column value.
 */
function denormaliseTaskPriority(priority: WorkspaceTask["priority"]): string {
  switch (priority) {
    case "urgent":
      return "Urgent";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Medium";
  }
}

/**
 * Map a Piper semantic field from a TaskPatch to a Graph field value.
 * Returns undefined if the field is not present in the patch.
 */
function mapPiperFieldToGraphField(
  semanticField: string,
  patch: TaskPatch,
): unknown | undefined {
  switch (semanticField) {
    case "title":
      return patch.title;
    case "description":
      return patch.description;
    case "status":
      return patch.status ? denormaliseTaskStatus(patch.status) : undefined;
    case "priority":
      return patch.priority ? denormaliseTaskPriority(patch.priority) : undefined;
    case "startDate":
      return patch.startDate;
    case "dueDate":
      return patch.dueDate;
    case "labels":
      return patch.labels;
    default:
      return undefined;
  }
}

/**
 * Check if a Piper field data type is compatible with a Graph column type.
 */
function isTypeCompatible(
  piperType: string,
  graphType: string,
): boolean {
  const compatibilityMap: Record<string, string[]> = {
    string: ["text", "note", "choice", "url"],
    text: ["text", "note"],
    markdown: ["text", "note"],
    number: ["number"],
    boolean: ["boolean"],
    date: ["dateTime"],
    datetime: ["dateTime"],
    person: ["person"],
    "person-multi": ["personMulti"],
    choice: ["choice", "text"],
    "choice-multi": ["choiceMulti", "choice"],
    labels: ["choiceMulti", "choice", "text", "note"],
    lookup: ["lookup"],
    "lookup-multi": ["lookupMulti"],
    url: ["url", "text"],
  };

  const allowed = compatibilityMap[piperType];
  return allowed ? allowed.includes(graphType) : false;
}
