/**
 * Default mapping heuristics — Suggest Piper semantic field mappings
 * based on MS Lists column names and data types.
 *
 * When a user connects a new MS Lists workspace, these heuristics
 * propose a field mapping config so they don't have to set up every
 * column manually. Users can then review and override.
 */

import type { WorkspaceFieldDataType } from "@/features/workspaces/types";
import type { FieldMapping } from "../schema-mapper";
import type { DetectedColumn } from "./column-type-detector";

/**
 * Piper semantic fields and the column name patterns that typically
 * correspond to them in MS Lists. Patterns are matched case-insensitively.
 *
 * Order matters: first match wins when multiple columns could map to the
 * same semantic field.
 */
interface SemanticFieldRule {
  semanticField: string;
  /** Column name patterns (case-insensitive, substring match). */
  namePatterns: string[];
  /** Acceptable Piper data types for this semantic field. */
  acceptedTypes: WorkspaceFieldDataType[];
  /** Whether this field is required in the mapping. */
  required?: boolean;
  /** Whether this field should be editable by default. */
  editable?: boolean;
}

const TASK_FIELD_RULES: SemanticFieldRule[] = [
  {
    semanticField: "title",
    namePatterns: ["title", "name", "subject", "summary"],
    acceptedTypes: ["string", "text"],
    required: true,
  },
  {
    semanticField: "status",
    namePatterns: ["status", "taskstatus", "state", "workflow"],
    acceptedTypes: ["choice", "string"],
    required: true,
  },
  {
    semanticField: "priority",
    namePatterns: ["priority", "urgency", "importance", "severity"],
    acceptedTypes: ["choice", "string", "number"],
  },
  {
    semanticField: "assignee",
    namePatterns: ["assignedto", "assignee", "assigned", "owner", "responsible"],
    acceptedTypes: ["person"],
  },
  {
    semanticField: "description",
    namePatterns: ["description", "details", "taskdetails", "body", "notes"],
    acceptedTypes: ["text", "markdown", "string"],
  },
  {
    semanticField: "startDate",
    namePatterns: ["startdate", "start", "begins", "from"],
    acceptedTypes: ["date", "datetime"],
  },
  {
    semanticField: "dueDate",
    namePatterns: ["duedate", "due", "deadline", "targetdate", "enddate", "end"],
    acceptedTypes: ["date", "datetime"],
  },
  {
    semanticField: "labels",
    namePatterns: ["tags", "labels", "categories", "keywords"],
    acceptedTypes: ["labels", "choice-multi", "string"],
  },
  {
    semanticField: "projectRef",
    namePatterns: ["project", "projectref", "projectid", "initiative"],
    acceptedTypes: ["lookup", "string"],
  },
  {
    semanticField: "parentTaskRef",
    namePatterns: ["parenttask", "parent", "parenttaskref"],
    acceptedTypes: ["lookup"],
  },
  {
    semanticField: "id",
    namePatterns: ["id"],
    acceptedTypes: ["number", "string"],
    required: true,
    editable: false,
  },
];

const PROJECT_FIELD_RULES: SemanticFieldRule[] = [
  {
    semanticField: "title",
    namePatterns: ["title", "name", "projectname"],
    acceptedTypes: ["string", "text"],
    required: true,
  },
  {
    semanticField: "projectCode",
    namePatterns: ["projectcode", "code", "key", "abbreviation"],
    acceptedTypes: ["string"],
    required: true,
  },
  {
    semanticField: "status",
    namePatterns: ["status", "projectstatus", "state"],
    acceptedTypes: ["choice", "string"],
    required: true,
  },
  {
    semanticField: "owner",
    namePatterns: ["owner", "projectowner", "lead", "manager"],
    acceptedTypes: ["person"],
  },
  {
    semanticField: "startDate",
    namePatterns: ["startdate", "start", "begins"],
    acceptedTypes: ["date", "datetime"],
  },
  {
    semanticField: "dueDate",
    namePatterns: ["targetdate", "duedate", "due", "deadline", "enddate"],
    acceptedTypes: ["date", "datetime"],
  },
  {
    semanticField: "description",
    namePatterns: ["description", "summary", "projectsummary", "details"],
    acceptedTypes: ["text", "markdown", "string"],
  },
  {
    semanticField: "parentProjectRef",
    namePatterns: ["parentproject", "parent", "program", "portfolio"],
    acceptedTypes: ["lookup"],
  },
  {
    semanticField: "id",
    namePatterns: ["id"],
    acceptedTypes: ["number", "string"],
    required: true,
    editable: false,
  },
];

/**
 * Result of heuristic mapping: suggested field mappings and
 * columns that couldn't be automatically matched.
 */
export interface MappingSuggestion {
  /** Confidently matched semantic field mappings. */
  fields: Record<string, FieldMapping>;
  /** Columns that were matched (by column name). */
  matchedColumns: string[];
  /** Columns that couldn't be matched to any semantic field. */
  unmatchedColumns: DetectedColumn[];
  /** Semantic fields that couldn't be matched to any column. */
  missingFields: string[];
}

/**
 * Normalise a column name for pattern matching.
 * Strips whitespace, underscores, hyphens; lowercases.
 */
function normaliseForMatch(name: string): string {
  return name.toLowerCase().replace(/[\s_\-]+/g, "");
}

/**
 * Suggest field mappings for a set of detected MS Lists columns
 * based on column name heuristics and data type compatibility.
 */
export function suggestFieldMappings(
  columns: DetectedColumn[],
  scope: "tasks" | "projects",
): MappingSuggestion {
  const rules = scope === "tasks" ? TASK_FIELD_RULES : PROJECT_FIELD_RULES;
  const fields: Record<string, FieldMapping> = {};
  const matchedColumnNames = new Set<string>();
  const matchedSemanticFields = new Set<string>();

  // Phase 1: exact normalised name match
  for (const rule of rules) {
    if (matchedSemanticFields.has(rule.semanticField)) continue;

    for (const column of columns) {
      if (matchedColumnNames.has(column.name)) continue;

      const normName = normaliseForMatch(column.name);
      const match = rule.namePatterns.some(
        (pattern) => normaliseForMatch(pattern) === normName,
      );

      if (match && rule.acceptedTypes.includes(column.dataType)) {
        fields[rule.semanticField] = {
          sourceField: column.name,
          dataType: column.dataType,
          required: rule.required ?? column.required,
          editable: rule.editable ?? column.editable,
        };
        matchedColumnNames.add(column.name);
        matchedSemanticFields.add(rule.semanticField);
        break;
      }
    }
  }

  // Phase 2: substring match for remaining unmatched rules
  for (const rule of rules) {
    if (matchedSemanticFields.has(rule.semanticField)) continue;

    for (const column of columns) {
      if (matchedColumnNames.has(column.name)) continue;

      const normName = normaliseForMatch(column.name);
      const match = rule.namePatterns.some(
        (pattern) =>
          normName.includes(normaliseForMatch(pattern)) ||
          normaliseForMatch(pattern).includes(normName),
      );

      if (match && rule.acceptedTypes.includes(column.dataType)) {
        fields[rule.semanticField] = {
          sourceField: column.name,
          dataType: column.dataType,
          required: rule.required ?? column.required,
          editable: rule.editable ?? column.editable,
        };
        matchedColumnNames.add(column.name);
        matchedSemanticFields.add(rule.semanticField);
        break;
      }
    }
  }

  // Phase 3: display name match (fallback for columns with internal names
  // that don't match but display names that do)
  for (const rule of rules) {
    if (matchedSemanticFields.has(rule.semanticField)) continue;

    for (const column of columns) {
      if (matchedColumnNames.has(column.name)) continue;

      const normDisplayName = normaliseForMatch(column.displayName);
      const match = rule.namePatterns.some(
        (pattern) =>
          normDisplayName.includes(normaliseForMatch(pattern)) ||
          normaliseForMatch(pattern).includes(normDisplayName),
      );

      if (match && rule.acceptedTypes.includes(column.dataType)) {
        fields[rule.semanticField] = {
          sourceField: column.name,
          dataType: column.dataType,
          required: rule.required ?? column.required,
          editable: rule.editable ?? column.editable,
        };
        matchedColumnNames.add(column.name);
        matchedSemanticFields.add(rule.semanticField);
        break;
      }
    }
  }

  const unmatchedColumns = columns.filter((c) => !matchedColumnNames.has(c.name));
  const allSemanticFields = rules.map((r) => r.semanticField);
  const missingFields = allSemanticFields.filter((f) => !matchedSemanticFields.has(f));

  return {
    fields,
    matchedColumns: Array.from(matchedColumnNames),
    unmatchedColumns,
    missingFields,
  };
}
