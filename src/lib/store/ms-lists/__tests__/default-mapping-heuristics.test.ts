import { describe, expect, it } from "vitest";
import { suggestFieldMappings } from "../default-mapping-heuristics";
import type { DetectedColumn } from "../column-type-detector";

function detectedCol(
  overrides: Partial<DetectedColumn> = {},
): DetectedColumn {
  return {
    name: "TestCol",
    displayName: "Test Column",
    dataType: "string",
    graphDataType: "text",
    required: false,
    editable: true,
    multiValue: false,
    ...overrides,
  };
}

describe("suggestFieldMappings", () => {
  describe("task scope", () => {
    it("maps standard MS Lists task columns", () => {
      const columns: DetectedColumn[] = [
        detectedCol({ name: "ID", displayName: "ID", dataType: "number", graphDataType: "number", editable: false, required: true }),
        detectedCol({ name: "Title", displayName: "Title", dataType: "string", graphDataType: "text", required: true }),
        detectedCol({ name: "TaskStatus", displayName: "Status", dataType: "choice", graphDataType: "choice" }),
        detectedCol({ name: "Priority", displayName: "Priority", dataType: "choice", graphDataType: "choice" }),
        detectedCol({ name: "AssignedTo", displayName: "Assigned To", dataType: "person", graphDataType: "person" }),
        detectedCol({ name: "TaskDetails", displayName: "Description", dataType: "text", graphDataType: "note" }),
        detectedCol({ name: "StartDate", displayName: "Start Date", dataType: "date", graphDataType: "dateTime" }),
        detectedCol({ name: "DueDate", displayName: "Due Date", dataType: "date", graphDataType: "dateTime" }),
        detectedCol({ name: "Tags", displayName: "Tags", dataType: "choice-multi", graphDataType: "choiceMulti" }),
        detectedCol({ name: "Project", displayName: "Project", dataType: "lookup", graphDataType: "lookup" }),
      ];

      const suggestion = suggestFieldMappings(columns, "tasks");

      expect(suggestion.fields.title?.sourceField).toBe("Title");
      expect(suggestion.fields.status?.sourceField).toBe("TaskStatus");
      expect(suggestion.fields.priority?.sourceField).toBe("Priority");
      expect(suggestion.fields.assignee?.sourceField).toBe("AssignedTo");
      expect(suggestion.fields.description?.sourceField).toBe("TaskDetails");
      expect(suggestion.fields.startDate?.sourceField).toBe("StartDate");
      expect(suggestion.fields.dueDate?.sourceField).toBe("DueDate");
      expect(suggestion.fields.labels?.sourceField).toBe("Tags");
      expect(suggestion.fields.projectRef?.sourceField).toBe("Project");
      expect(suggestion.fields.id?.sourceField).toBe("ID");
      expect(suggestion.fields.id?.editable).toBe(false);
    });

    it("reports unmatched columns", () => {
      const columns: DetectedColumn[] = [
        detectedCol({ name: "Title", dataType: "string" }),
        detectedCol({ name: "CustomField1", displayName: "Custom Field 1", dataType: "string" }),
        detectedCol({ name: "WeirdMetric", displayName: "Weird Metric", dataType: "number" }),
      ];

      const suggestion = suggestFieldMappings(columns, "tasks");
      expect(suggestion.unmatchedColumns.map((c) => c.name)).toContain("CustomField1");
      expect(suggestion.unmatchedColumns.map((c) => c.name)).toContain("WeirdMetric");
    });

    it("reports missing required fields", () => {
      // Only provide ID, no title or status
      const columns: DetectedColumn[] = [
        detectedCol({ name: "ID", dataType: "number", editable: false, required: true }),
      ];

      const suggestion = suggestFieldMappings(columns, "tasks");
      expect(suggestion.missingFields).toContain("title");
      expect(suggestion.missingFields).toContain("status");
    });

    it("does not double-map columns", () => {
      // A column named "Status" should only map to "status", not also "title"
      const columns: DetectedColumn[] = [
        detectedCol({ name: "Title", dataType: "string" }),
        detectedCol({ name: "Status", dataType: "choice" }),
      ];

      const suggestion = suggestFieldMappings(columns, "tasks");
      expect(suggestion.fields.title?.sourceField).toBe("Title");
      expect(suggestion.fields.status?.sourceField).toBe("Status");
      // Title column should not be also mapped as status
      expect(suggestion.matchedColumns).toContain("Title");
      expect(suggestion.matchedColumns).toContain("Status");
    });

    it("handles case-insensitive matching", () => {
      const columns: DetectedColumn[] = [
        detectedCol({ name: "TITLE", displayName: "TITLE", dataType: "string" }),
        detectedCol({ name: "taskstatus", displayName: "taskstatus", dataType: "choice" }),
      ];

      const suggestion = suggestFieldMappings(columns, "tasks");
      expect(suggestion.fields.title?.sourceField).toBe("TITLE");
      expect(suggestion.fields.status?.sourceField).toBe("taskstatus");
    });

    it("matches by display name when internal name differs", () => {
      const columns: DetectedColumn[] = [
        detectedCol({ name: "field_0", displayName: "Title", dataType: "string" }),
        detectedCol({ name: "field_1", displayName: "Status", dataType: "choice" }),
      ];

      const suggestion = suggestFieldMappings(columns, "tasks");
      expect(suggestion.fields.title?.sourceField).toBe("field_0");
      expect(suggestion.fields.status?.sourceField).toBe("field_1");
    });

    it("skips type-incompatible columns", () => {
      // A column named "Status" with type "number" should not match
      const columns: DetectedColumn[] = [
        detectedCol({ name: "Status", dataType: "number", graphDataType: "number" }),
      ];

      const suggestion = suggestFieldMappings(columns, "tasks");
      expect(suggestion.fields.status).toBeUndefined();
      expect(suggestion.missingFields).toContain("status");
    });
  });

  describe("project scope", () => {
    it("maps standard MS Lists project columns", () => {
      const columns: DetectedColumn[] = [
        detectedCol({ name: "ID", dataType: "number", editable: false, required: true }),
        detectedCol({ name: "Title", dataType: "string", required: true }),
        detectedCol({ name: "ProjectCode", dataType: "string" }),
        detectedCol({ name: "ProjectStatus", dataType: "choice" }),
        detectedCol({ name: "ProjectOwner", dataType: "person" }),
        detectedCol({ name: "StartDate", dataType: "date" }),
        detectedCol({ name: "TargetDate", dataType: "date" }),
        detectedCol({ name: "ProjectSummary", dataType: "text" }),
        detectedCol({ name: "ParentProject", dataType: "lookup" }),
      ];

      const suggestion = suggestFieldMappings(columns, "projects");

      expect(suggestion.fields.title?.sourceField).toBe("Title");
      expect(suggestion.fields.projectCode?.sourceField).toBe("ProjectCode");
      expect(suggestion.fields.status?.sourceField).toBe("ProjectStatus");
      expect(suggestion.fields.owner?.sourceField).toBe("ProjectOwner");
      expect(suggestion.fields.startDate?.sourceField).toBe("StartDate");
      expect(suggestion.fields.dueDate?.sourceField).toBe("TargetDate");
      expect(suggestion.fields.description?.sourceField).toBe("ProjectSummary");
      expect(suggestion.fields.parentProjectRef?.sourceField).toBe("ParentProject");
    });
  });
});
