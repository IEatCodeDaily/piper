/**
 * Schema Mapping Engine — Bidirectional Piper ↔ Microsoft Lists column mapping.
 *
 * This module provides the formal mapping layer between Piper's unified issue schema
 * and Microsoft Lists column definitions. It serves as the foundation for:
 *
 *   - Read mapping: GraphListItem.fields → Piper entities (used by graph adapter)
 *   - Write mapping: Piper entity fields → GraphListItem field payload (used by push sync)
 *   - Column introspection: auto-detecting column types from Graph metadata
 *   - Custom column preservation: carrying unmapped columns through sync cycles
 *
 * Dependencies: M1 (auth), M2 (CRUD) — both complete.
 * Consumers: M4 (sync engine), graph adapter, workspace validation.
 *
 * @module schema-mapping
 */

import type { WorkspaceConfig, WorkspaceEntityScope, WorkspaceListConfig, WorkspaceFieldMapping } from "@/features/workspaces/types";
import type {
  GraphColumnDataType,
  GraphListColumnDefinition,
  GraphListItem,
  GraphListItemFields,
  GraphListFieldValue,
  GraphFieldPersonValue,
  GraphFieldLookupValue,
} from "@/lib/graph/types";

// ---------------------------------------------------------------------------
// 1. Column type detection
// ---------------------------------------------------------------------------

/**
 * Maps a Graph column's `dataType` to a workspace field data type.
 * Used when auto-detecting column types from live MS Lists metadata.
 */
export function graphColumnDataTypeToWorkspaceFieldType(
  column: GraphListColumnDefinition,
): WorkspaceFieldMapping["dataType"] | undefined {
  switch (column.dataType) {
    case "text":
      return "string";
    case "note":
      return "text";
    case "number":
      return "number";
    case "boolean":
      return "boolean";
    case "dateTime":
      return "date";
    case "person":
      return column.multiValue ? "person-multi" : "person";
    case "personMulti":
      return "person-multi";
    case "choice":
      return column.multiValue ? "choice-multi" : "choice";
    case "choiceMulti":
      return "choice-multi";
    case "lookup":
      return column.multiValue ? "lookup-multi" : "lookup";
    case "lookupMulti":
      return "lookup-multi";
    case "url":
      return "url";
    case "unknown":
      return undefined;
    default:
      return undefined;
  }
}

/**
 * Derives a WorkspaceFieldMapping from a Graph column definition.
 * Returns undefined if the column type is unsupported.
 */
export function deriveFieldMappingFromColumn(
  column: GraphListColumnDefinition,
): WorkspaceFieldMapping | undefined {
  const dataType = graphColumnDataTypeToWorkspaceFieldType(column);
  if (!dataType) {
    return undefined;
  }

  return {
    sourceField: column.name,
    dataType,
    required: column.required ?? false,
    editable: column.readOnly !== true,
    description: column.displayName !== column.name ? column.displayName : undefined,
  };
}

// ---------------------------------------------------------------------------
// 2. Schema introspection helpers
// ---------------------------------------------------------------------------

/**
 * Builds a lookup from sourceField → semanticField for a given scope.
 */
export function buildSourceFieldLookup(
  listConfig: WorkspaceListConfig,
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const [semanticField, mapping] of Object.entries(listConfig.fields)) {
    lookup.set(mapping.sourceField, semanticField);
  }
  return lookup;
}

/**
 * Returns the set of source field names declared in the workspace config for a scope.
 */
export function getConfiguredSourceFields(listConfig: WorkspaceListConfig): Set<string> {
  return new Set(Object.values(listConfig.fields).map((m) => m.sourceField));
}

/**
 * Returns the set of semantic field keys declared in the workspace config for a scope.
 */
export function getConfiguredSemanticFields(listConfig: WorkspaceListConfig): Set<string> {
  return new Set(Object.keys(listConfig.fields));
}

/**
 * Identifies columns present in MS Lists metadata that are NOT covered by the
 * workspace config's field mappings. These are "custom" columns that should be
 * preserved through sync operations.
 */
export function detectCustomColumns(
  listConfig: WorkspaceListConfig,
  columns: GraphListColumnDefinition[],
): GraphListColumnDefinition[] {
  const configuredSourceFields = getConfiguredSourceFields(listConfig);
  // System columns that Piper ignores but are always present
  const systemColumns = new Set([
    "Title", // Often used by SharePoint as default; may or may not be mapped
    "ComplianceAssetId",
    "Attachments",
    "Edit", // Built-in button column
    "LinkTitle", // Computed from Title
    "LinkTitleNoMenu",
    "DocIcon",
    "ContentType",
    "Order", // Built-in sort column
    "FSObjType",
    "FileDirRef",
    "FileRef",
    "FileLeafRef",
    "ItemChildCount",
    "FolderChildCount",
    "AppAuthor",
    "AppEditor",
    // Graph metadata fields (not actual list columns)
    "OData__UIVersionString",
    "OData__ColorTag",
    "_UIVersionString",
    "_ColorTag",
    "_ComplianceTag",
    "_ComplianceTagWrittenTime",
    "_ComplianceTagUserId",
  ]);

  return columns.filter((col) => {
    if (configuredSourceFields.has(col.name)) return false;
    if (col.hidden) return false;
    if (systemColumns.has(col.name)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// 3. Internal (Piper-managed) column definitions
// ---------------------------------------------------------------------------

/**
 * Internal columns that Piper manages but are NOT part of the configurable
 * workspace field mapping. These always have fixed source field names.
 *
 * These columns carry structured data (JSON), computed values, or metadata
 * that Piper stores in MS Lists but manages with dedicated logic.
 */
export const PIPER_INTERNAL_COLUMNS = {
  tasks: {
    TaskKey: { dataType: "string" as const, editable: true, description: "Short task key (e.g. T-42)" },
    Reporter: { dataType: "person" as const, editable: true, description: "Person who reported the task" },
    Watchers: { dataType: "person-multi" as const, editable: true, description: "People watching the task" },
    ChecklistData: { dataType: "text" as const, editable: true, description: "JSON-serialized checklist items" },
    AttachmentLinks: { dataType: "text" as const, editable: true, description: "JSON-serialized attachment metadata" },
    CompletedAt: { dataType: "date" as const, editable: true, description: "Date when the task was completed" },
    EstimatePoints: { dataType: "number" as const, editable: true, description: "Story point estimate" },
    RemainingPoints: { dataType: "number" as const, editable: true, description: "Remaining story points" },
    SortOrder: { dataType: "number" as const, editable: true, description: "Sort order for manual ranking" },
    PiperPath: { dataType: "string" as const, editable: true, description: "Breadcrumb path (e.g. 'Parent > Child')" },
  },
  projects: {
    ProjectHealth: { dataType: "string" as const, editable: true, description: "Project health status" },
    ProjectHealthSummary: { dataType: "text" as const, editable: true, description: "Health summary narrative" },
    ProjectPriority: { dataType: "string" as const, editable: true, description: "Project priority level" },
    Collaborators: { dataType: "person-multi" as const, editable: true, description: "Project collaborators" },
    ProgressPercent: { dataType: "number" as const, editable: true, description: "Completion percentage" },
    Tags: { dataType: "labels" as const, editable: true, description: "Project tags/labels" },
    PiperPath: { dataType: "string" as const, editable: true, description: "Breadcrumb path" },
    MilestoneData: { dataType: "text" as const, editable: true, description: "JSON-serialized milestones" },
    TaskCount: { dataType: "number" as const, editable: false, description: "Computed task count (read-only aggregate)" },
    OpenTaskCount: { dataType: "number" as const, editable: false, description: "Computed open task count (read-only aggregate)" },
  },
} as const;

export type PiperInternalColumnName<S extends WorkspaceEntityScope> =
  keyof (typeof PIPER_INTERNAL_COLUMNS)[S];

/**
 * Returns all source field names that Piper manages for a scope,
 * combining config-mapped fields + internal columns.
 */
export function getAllManagedSourceFields(listConfig: WorkspaceListConfig, scope: WorkspaceEntityScope): Set<string> {
  const configured = getConfiguredSourceFields(listConfig);
  const internal = PIPER_INTERNAL_COLUMNS[scope];
  for (const key of Object.keys(internal)) {
    configured.add(key);
  }
  return configured;
}

// ---------------------------------------------------------------------------
// 4. Bidirectional field mapping — SchemaMapper
// ---------------------------------------------------------------------------

/**
 * Reverse normalization maps: Piper enum values → SharePoint display values.
 * These map the canonical Piper value to the most common SharePoint choice value.
 * The actual mapping is case-insensitive; these are the preferred output values.
 */
export const TASK_STATUS_TO_SHAREPOINT: Record<string, string> = {
  backlog: "Backlog",
  planned: "Not Started",
  "in-progress": "In Progress",
  blocked: "Blocked",
  "in-review": "In Review",
  done: "Done",
};

export const TASK_PRIORITY_TO_SHAREPOINT: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PROJECT_STATUS_TO_SHAREPOINT: Record<string, string> = {
  planned: "Planned",
  active: "Active",
  blocked: "Blocked",
  "on-hold": "On Hold",
  complete: "Done",
};

export const PROJECT_PRIORITY_TO_SHAREPOINT: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

export const PROJECT_HEALTH_TO_SHAREPOINT: Record<string, string> = {
  "on-track": "On Track",
  "at-risk": "At Risk",
  "off-track": "Off Track",
  done: "Done",
};

/**
 * Result of mapping a Piper task to a Graph fields payload for write-back.
 */
export interface TaskWritePayload {
  fields: GraphListItemFields;
  /** Semantic fields that were mapped and included */
  mappedFields: string[];
  /** Custom/internal columns that were not modified (passthrough) */
  passthroughFields: string[];
}

/**
 * Result of mapping a Piper project to a Graph fields payload for write-back.
 */
export interface ProjectWritePayload {
  fields: GraphListItemFields;
  mappedFields: string[];
  passthroughFields: string[];
}

/**
 * SchemaMapper encapsulates bidirectional mapping for a specific workspace scope.
 *
 * Usage:
 *   const mapper = new SchemaMapper(config, "tasks");
 *   // Read: already handled by piper-graph-adapter functions
 *   // Write:
 *   const payload = mapper.mapTaskToFields(task, existingItem);
 */
export class SchemaMapper {
  private readonly listConfig: WorkspaceListConfig;
  private readonly scope: WorkspaceEntityScope;
  private readonly sourceFieldLookup: Map<string, string>;

  constructor(
    private readonly workspaceConfig: WorkspaceConfig,
    scope: WorkspaceEntityScope,
  ) {
    this.scope = scope;
    this.listConfig = workspaceConfig.lists[scope];
    this.sourceFieldLookup = buildSourceFieldLookup(this.listConfig);
  }

  // --- Introspection -------------------------------------------------------

  /** Get the semantic field key for a given source field name, if mapped. */
  semanticFieldForSource(sourceField: string): string | undefined {
    return this.sourceFieldLookup.get(sourceField);
  }

  /** Get the source field name for a given semantic field key. */
  sourceFieldForSemantic(semanticField: string): string | undefined {
    return this.listConfig.fields[semanticField]?.sourceField;
  }

  /** Get the field mapping config for a semantic field. */
  fieldMapping(semanticField: string): WorkspaceFieldMapping | undefined {
    return this.listConfig.fields[semanticField];
  }

  /** Whether a source field is declared in the workspace config. */
  isConfiguredSourceField(sourceField: string): boolean {
    return this.sourceFieldLookup.has(sourceField);
  }

  /** Whether a source field is an internal Piper-managed column. */
  isInternalColumn(sourceField: string): boolean {
    return sourceField in PIPER_INTERNAL_COLUMNS[this.scope];
  }

  /** List all semantic field keys. */
  get semanticFields(): string[] {
    return Object.keys(this.listConfig.fields);
  }

  /** List all configured source field names. */
  get sourceFields(): string[] {
    return Object.values(this.listConfig.fields).map((m) => m.sourceField);
  }

  // --- Read direction helpers -----------------------------------------------

  /**
   * Extracts the value of a semantic field from a GraphListItem.
   * Returns undefined if the field is not mapped or has no value.
   */
  readFieldValue(item: GraphListItem, semanticField: string): GraphListFieldValue | undefined {
    const sourceField = this.sourceFieldForSemantic(semanticField);
    if (!sourceField) return undefined;
    return item.fields[sourceField];
  }

  /**
   * Extracts custom (unmapped) column values from a GraphListItem.
   * These are columns present in the item that are neither config-mapped
   * nor Piper-internal columns.
   */
  readCustomColumns(item: GraphListItem): GraphListItemFields {
    const managedFields = getAllManagedSourceFields(this.listConfig, this.scope);
    const custom: GraphListItemFields = {};

    for (const [key, value] of Object.entries(item.fields)) {
      if (!managedFields.has(key) && value !== undefined) {
        custom[key] = value;
      }
    }

    return custom;
  }

  // --- Write direction: Piper Task → Graph fields -------------------------

  /**
   * Maps a partial Piper WorkspaceTask update to a Graph fields payload.
   * Only the fields present in `updates` are included in the payload.
   * Custom columns from the existing item are passed through unchanged.
   *
   * @param updates Partial task fields to write (semantic field names as keys)
   * @param existingItem The current GraphListItem (for custom column passthrough)
   * @returns A write payload with mapped fields and passthrough fields
   */
  mapTaskUpdateToFields(
    updates: Partial<Record<string, unknown>>,
    existingItem?: GraphListItem,
  ): TaskWritePayload {
    const fields: GraphListItemFields = {};
    const mappedFields: string[] = [];
    const passthroughFields: string[] = [];

    // Map semantic field updates to source field values
    for (const [semanticField, value] of Object.entries(updates)) {
      if (value === undefined) continue;

      const mapped = this.mapTaskSemanticField(semanticField, value);
      if (mapped !== undefined) {
        fields[mapped.sourceField] = mapped.value;
        mappedFields.push(semanticField);
      }
    }

    // Pass through custom columns from existing item
    if (existingItem) {
      const customColumns = this.readCustomColumns(existingItem);
      for (const [key, value] of Object.entries(customColumns)) {
        if (!(key in fields)) {
          fields[key] = value;
          passthroughFields.push(key);
        }
      }
    }

    return { fields, mappedFields, passthroughFields };
  }

  /**
   * Maps a single semantic field value for a task to its Graph source field value.
   */
  private mapTaskSemanticField(
    semanticField: string,
    value: unknown,
  ): { sourceField: string; value: GraphListFieldValue } | undefined {
    const mapping = this.listConfig.fields[semanticField];
    if (!mapping) return undefined;

    switch (semanticField) {
      case "title":
      case "description":
        return { sourceField: mapping.sourceField, value: typeof value === "string" ? value : String(value ?? "") };

      case "status":
        return {
          sourceField: mapping.sourceField,
          value: TASK_STATUS_TO_SHAREPOINT[value as string] ?? String(value),
        };

      case "priority":
        return {
          sourceField: mapping.sourceField,
          value: TASK_PRIORITY_TO_SHAREPOINT[value as string] ?? String(value),
        };

      case "assignee":
        return { sourceField: mapping.sourceField, value: this.personToGraphValue(value) };

      case "startDate":
      case "dueDate":
        return { sourceField: mapping.sourceField, value: typeof value === "string" ? value : undefined };

      case "labels":
        return { sourceField: mapping.sourceField, value: this.labelsToGraphValue(value) };

      case "projectRef":
      case "parentTaskRef":
        return { sourceField: mapping.sourceField, value: this.lookupToGraphValue(value) };

      default:
        // Generic passthrough for custom semantic fields
        return { sourceField: mapping.sourceField, value: value as GraphListFieldValue };
    }
  }

  // --- Write direction: Piper Project → Graph fields ----------------------

  /**
   * Maps a partial Piper WorkspaceProject update to a Graph fields payload.
   */
  mapProjectUpdateToFields(
    updates: Partial<Record<string, unknown>>,
    existingItem?: GraphListItem,
  ): ProjectWritePayload {
    const fields: GraphListItemFields = {};
    const mappedFields: string[] = [];
    const passthroughFields: string[] = [];

    for (const [semanticField, value] of Object.entries(updates)) {
      if (value === undefined) continue;

      const mapped = this.mapProjectSemanticField(semanticField, value);
      if (mapped !== undefined) {
        fields[mapped.sourceField] = mapped.value;
        mappedFields.push(semanticField);
      }
    }

    if (existingItem) {
      const customColumns = this.readCustomColumns(existingItem);
      for (const [key, value] of Object.entries(customColumns)) {
        if (!(key in fields)) {
          fields[key] = value;
          passthroughFields.push(key);
        }
      }
    }

    return { fields, mappedFields, passthroughFields };
  }

  /**
   * Maps a single semantic field value for a project to its Graph source field value.
   */
  private mapProjectSemanticField(
    semanticField: string,
    value: unknown,
  ): { sourceField: string; value: GraphListFieldValue } | undefined {
    const mapping = this.listConfig.fields[semanticField];
    if (!mapping) return undefined;

    switch (semanticField) {
      case "title":
      case "description":
      case "projectCode":
        return { sourceField: mapping.sourceField, value: typeof value === "string" ? value : String(value ?? "") };

      case "status":
        return {
          sourceField: mapping.sourceField,
          value: PROJECT_STATUS_TO_SHAREPOINT[value as string] ?? String(value),
        };

      case "owner":
        return { sourceField: mapping.sourceField, value: this.personToGraphValue(value) };

      case "startDate":
      case "dueDate":
        return { sourceField: mapping.sourceField, value: typeof value === "string" ? value : undefined };

      case "parentProjectRef":
        return { sourceField: mapping.sourceField, value: this.lookupToGraphValue(value) };

      default:
        return { sourceField: mapping.sourceField, value: value as GraphListFieldValue };
    }
  }

  // --- Write direction: Piper internal columns ----------------------------

  /**
   * Maps Piper internal column values to Graph fields for write-back.
   * These are columns managed with dedicated logic (checklists, attachments, etc.).
   */
  mapInternalFields(
    data: Partial<Record<string, unknown>>,
    scope: WorkspaceEntityScope,
  ): GraphListItemFields {
    const fields: GraphListItemFields = {};
    const internalDefs = PIPER_INTERNAL_COLUMNS[scope];

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;
      if (key in internalDefs) {
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          // JSON-serialize structured data (checklists, attachments, milestones)
          fields[key] = JSON.stringify(value);
        } else if (Array.isArray(value)) {
          fields[key] = JSON.stringify(value);
        } else {
          fields[key] = value as GraphListFieldValue;
        }
      }
    }

    return fields;
  }

  // --- Value conversion helpers --------------------------------------------

  private personToGraphValue(value: unknown): GraphListFieldValue {
    if (value === null || value === undefined) return null;

    // PersonRef → GraphFieldPersonValue
    const person = value as Record<string, unknown>;
    if (typeof person === "object" && ("email" in person || "displayName" in person)) {
      return {
        LookupId: Number(person.externalId ?? person.lookupId ?? 0),
        LookupValue: String(person.displayName ?? ""),
        Email: String(person.email ?? ""),
        DisplayName: String(person.displayName ?? ""),
      } as GraphFieldPersonValue;
    }

    return String(value);
  }

  private labelsToGraphValue(value: unknown): GraphListFieldValue {
    if (Array.isArray(value)) {
      return value.filter((v): v is string => typeof v === "string").join("; ");
    }
    if (typeof value === "string") return value;
    return "";
  }

  private lookupToGraphValue(value: unknown): GraphListFieldValue {
    if (value === null || value === undefined) return null;

    // If it's a lookup reference with a lookupId
    const ref = value as Record<string, unknown>;
    if (typeof ref === "object" && ("lookupId" in ref || "LookupId" in ref)) {
      return {
        LookupId: Number(ref.lookupId ?? ref.LookupId ?? 0),
        LookupValue: String(ref.lookupValue ?? ref.LookupValue ?? ""),
      } as GraphFieldLookupValue;
    }

    return String(value);
  }
}

// ---------------------------------------------------------------------------
// 5. Convenience factory
// ---------------------------------------------------------------------------

/**
 * Creates a SchemaMapper for the given workspace and scope.
 */
export function createSchemaMapper(
  workspaceConfig: WorkspaceConfig,
  scope: WorkspaceEntityScope,
): SchemaMapper {
  return new SchemaMapper(workspaceConfig, scope);
}
