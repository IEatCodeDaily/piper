/**
 * LinearSchemaMapper — SchemaMapper implementation for the Linear GraphQL API.
 *
 * Delegates to the existing mapping functions in linear-adapter.ts and
 * wraps them in the SchemaMapper interface. This provides bidirectional
 * field translation between Piper's unified schema and Linear's native schema.
 */

import type { CommentRef } from "@/features/comments/types"
import type { WorkspaceProject } from "@/features/projects/types"
import type { WorkspaceTask } from "@/features/tasks/types"
import type { WorkspaceConfig } from "@/features/workspaces/types"
import type {
  FieldMappingConfig,
  MappingContext,
  SchemaMapper,
  ValidationIssue,
  ValidationResult,
} from "@/lib/store/schema-mapper"
import type { CreateCommentInput, CreateTaskInput, TaskPatch } from "@/lib/store/types"

import type { LinearIssue, LinearProject } from "./linear-types"
import {
  mapLinearCommentToCommentRef,
  mapLinearIssueToWorkspaceTask,
  mapLinearProjectToWorkspaceProject,
} from "./linear-adapter"

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface LinearMapperContext {
  /** The full workspace config (existing format). */
  workspaceConfig: WorkspaceConfig
}

// ---------------------------------------------------------------------------
// LinearSchemaMapper
// ---------------------------------------------------------------------------

export class LinearSchemaMapper implements SchemaMapper<LinearIssue> {
  readonly backendId = "linear"

  private readonly context: LinearMapperContext

  constructor(context: LinearMapperContext) {
    this.context = context
  }

  // -- Backend -> Piper -----------------------------------------------------

  toTask(backendItem: LinearIssue, _config: FieldMappingConfig): WorkspaceTask {
    return mapLinearIssueToWorkspaceTask({
      workspaceConfig: this.context.workspaceConfig,
      issue: backendItem,
    })
  }

  toProject(
    backendItem: LinearProject,
    _config: FieldMappingConfig,
  ): WorkspaceProject {
    return mapLinearProjectToWorkspaceProject({
      workspaceConfig: this.context.workspaceConfig,
      project: backendItem,
    })
  }

  toComment(backendItem: unknown, context: MappingContext): CommentRef {
    return mapLinearCommentToCommentRef({
      workspaceConfig: this.context.workspaceConfig,
      comment: backendItem as Parameters<typeof mapLinearCommentToCommentRef>[0]["comment"],
      entityType: (context.entityType as CommentRef["entityType"]) ?? "task",
    })
  }

  // -- Piper -> Backend -----------------------------------------------------

  fromTaskPatch(patch: TaskPatch, _config: FieldMappingConfig): Partial<LinearIssue> {
    const updatePayload: Record<string, unknown> = {}

    if (patch.title !== undefined) updatePayload.title = patch.title
    if (patch.description !== undefined) updatePayload.description = patch.description

    // Status -> stateId mapping requires workflow state lookup at the store level.
    // The mapper only converts the value; stateId resolution happens in LinearIssueStore.
    if (patch.status !== undefined) {
      updatePayload._piperStatus = patch.status
    }

    if (patch.priority !== undefined) {
      updatePayload.priority = piperPriorityToLinear(patch.priority)
    }

    if (patch.dueDate !== undefined) {
      updatePayload.dueDate = patch.dueDate ?? null
    }

    if (patch.labels !== undefined) {
      // Labels need ID lookup; store handles this.
      updatePayload._piperLabels = patch.labels
    }

    if (patch.assigneeId !== undefined) {
      updatePayload.assigneeId = patch.assigneeId ?? null
    }

    return updatePayload as Partial<LinearIssue>
  }

  fromCreateTask(input: CreateTaskInput, _config: FieldMappingConfig): LinearIssue {
    return {
      id: "",
      identifier: "",
      title: input.title,
      description: input.description ?? null,
      url: "",
      priority: input.priority
        ? piperPriorityToLinear(input.priority)
        : 0,
      sortOrder: 0,
      estimate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      canceledAt: null,
      startedAt: null,
      dueDate: input.dueDate ?? null,
      state: { id: "", name: "Backlog", type: "backlog", color: "#C5C5C5" },
      assignee: null,
      creator: {
        id: "",
        name: "",
        displayName: "",
        email: "",
        active: true,
        isBot: false,
      },
      labels: { nodes: [] },
      project: null,
      team: { id: "", name: "", key: "", description: null, createdAt: "", updatedAt: "" },
      cycle: null,
      parent: null,
      commentCount: 0,
    }
  }

  fromCreateComment(input: CreateCommentInput): unknown {
    return {
      body: input.body,
      bodyFormat: input.bodyFormat === "html" ? "html" : "markdown",
    }
  }

  // -- Validation -----------------------------------------------------------

  validateConfig(
    config: FieldMappingConfig,
    _backendSchema: unknown,
  ): ValidationResult {
    const issues: ValidationIssue[] = []

    // Linear has a well-known schema; validate that required Piper
    // semantic fields have mappings defined.
    const requiredFields = ["title", "status"]
    for (const required of requiredFields) {
      if (!config.fields[required]) {
        issues.push({
          field: required,
          message: `Required semantic field "${required}" is not mapped.`,
          severity: "error",
        })
      }
    }

    return {
      valid: issues.every((i) => i.severity !== "error"),
      issues,
    }
  }
}

// ---------------------------------------------------------------------------
// Priority mapping helpers
// ---------------------------------------------------------------------------

function piperPriorityToLinear(priority: WorkspaceTask["priority"]): number {
  switch (priority) {
    case "urgent":
      return 1
    case "high":
      return 2
    case "medium":
      return 3
    case "low":
      return 4
    default:
      return 0
  }
}
