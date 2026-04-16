/**
 * MS Lists adapter — Microsoft Lists / SharePoint Lists backend.
 *
 * Phase 1 implementation of the IssueStore adapter layer.
 */

// Schema mapper
export { MsListsSchemaMapper } from "./ms-lists-schema-mapper";
export type { MsListsMapperContext } from "./ms-lists-schema-mapper";

// Column type detection
export {
  detectFieldDataType,
  detectColumns,
  isColumnEditable,
  isColumnRequired,
} from "./column-type-detector";
export type { DetectedColumn } from "./column-type-detector";

// Default mapping heuristics
export { suggestFieldMappings } from "./default-mapping-heuristics";
export type { MappingSuggestion } from "./default-mapping-heuristics";

// MS Lists issue store
export { MsListsIssueStore } from "./ms-lists-issue-store";
export type {
  MsListsBackendConfig,
  MsListsConnectionState,
  MsListsConnectionStatus,
} from "./ms-lists-issue-store";
