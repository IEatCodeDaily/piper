/**
 * Column type detector — Auto-detect Piper field data types from
 * MS Lists column definitions returned by the Graph API.
 *
 * Maps Graph column data types to Piper's semantic field types,
 * accounting for multi-value columns.
 */

import type { GraphColumnDataType, GraphListColumnDefinition } from "@/lib/graph/types";
import type { WorkspaceFieldDataType } from "@/features/workspaces/types";

/**
 * Map a Graph column data type to the closest Piper field data type.
 */
export function detectFieldDataType(
  column: GraphListColumnDefinition,
): WorkspaceFieldDataType {
  const mapping: Record<GraphColumnDataType, WorkspaceFieldDataType> = {
    text: "string",
    note: "text",
    number: "number",
    boolean: "boolean",
    dateTime: "date",
    person: "person",
    personMulti: "person-multi",
    choice: "choice",
    choiceMulti: "choice-multi",
    lookup: "lookup",
    lookupMulti: "lookup-multi",
    url: "url",
    unknown: "string",
  };

  return mapping[column.dataType] ?? "string";
}

/**
 * Determine whether a column is likely editable based on Graph metadata.
 */
export function isColumnEditable(column: GraphListColumnDefinition): boolean {
  if (column.readOnly) return false;
  if (column.hidden) return false;
  // SharePoint system columns are typically not editable
  if (column.name === "ID" || column.name === "Created" || column.name === "Modified") return false;
  return true;
}

/**
 * Determine whether a column is likely required.
 */
export function isColumnRequired(column: GraphListColumnDefinition): boolean {
  return column.required === true;
}

/**
 * Auto-detect all column types for a list and return field metadata.
 */
export interface DetectedColumn {
  name: string;
  displayName: string;
  dataType: WorkspaceFieldDataType;
  graphDataType: GraphColumnDataType;
  required: boolean;
  editable: boolean;
  multiValue: boolean;
}

export function detectColumns(
  columns: GraphListColumnDefinition[],
): DetectedColumn[] {
  return columns
    .filter((col) => !col.hidden)
    .map((col) => ({
      name: col.name,
      displayName: col.displayName,
      dataType: detectFieldDataType(col),
      graphDataType: col.dataType,
      required: isColumnRequired(col),
      editable: isColumnEditable(col),
      multiValue: col.multiValue === true,
    }));
}
