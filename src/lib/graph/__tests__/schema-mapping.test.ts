import { describe, it, expect } from "vitest";
import type { WorkspaceConfig, WorkspaceEntityScope } from "@/features/workspaces/types";
import type {
  GraphListColumnDefinition,
  GraphListItem,
  GraphFieldPersonValue,
} from "@/lib/graph/types";
import {
  graphColumnDataTypeToWorkspaceFieldType,
  deriveFieldMappingFromColumn,
  buildSourceFieldLookup,
  getConfiguredSourceFields,
  getConfiguredSemanticFields,
  detectCustomColumns,
  getAllManagedSourceFields,
  createSchemaMapper,
  SchemaMapper,
  PIPER_INTERNAL_COLUMNS,
  TASK_STATUS_TO_SHAREPOINT,
  TASK_PRIORITY_TO_SHAREPOINT,
  PROJECT_STATUS_TO_SHAREPOINT,
  PROJECT_PRIORITY_TO_SHAREPOINT,
  PROJECT_HEALTH_TO_SHAREPOINT,
} from "@/lib/graph/schema-mapping";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeTestConfig(): WorkspaceConfig {
  return {
    version: 1,
    workspace: {
      id: "test-workspace",
      label: "Test Workspace",
      description: "A test workspace.",
      tenant: {
        id: "tenant-001",
        label: "Test Tenant",
        domain: "test.example.com",
      },
    },
    lists: {
      tasks: {
        site: { id: "site-tasks", label: "Tasks Site" },
        list: { id: "list-tasks", label: "Tasks" },
        fields: {
          title: { sourceField: "Title", dataType: "string", required: true, editable: true },
          status: { sourceField: "TaskStatus", dataType: "choice", required: true, editable: true },
          priority: { sourceField: "TaskPriority", dataType: "choice", required: true, editable: true },
          description: { sourceField: "Body", dataType: "text", required: false, editable: true },
          assignee: { sourceField: "AssignedTo", dataType: "person", required: false, editable: true },
          projectRef: { sourceField: "ProjectLookup", dataType: "lookup", required: false, editable: true },
          parentTaskRef: { sourceField: "ParentTask", dataType: "lookup", required: false, editable: true },
          startDate: { sourceField: "StartDate", dataType: "date", required: false, editable: true },
          dueDate: { sourceField: "DueDate", dataType: "date", required: false, editable: true },
          labels: { sourceField: "Tags", dataType: "labels", required: false, editable: true },
        },
        renderers: {},
        relations: {},
      },
      projects: {
        site: { id: "site-projects", label: "Projects Site" },
        list: { id: "list-projects", label: "Projects" },
        fields: {
          title: { sourceField: "Title", dataType: "string", required: true, editable: true },
          status: { sourceField: "ProjectStatus", dataType: "choice", required: true, editable: true },
          owner: { sourceField: "ProjectOwner", dataType: "person", required: false, editable: true },
          description: { sourceField: "Description", dataType: "text", required: false, editable: true },
          projectCode: { sourceField: "ProjectCode", dataType: "string", required: true, editable: true },
          startDate: { sourceField: "StartDate", dataType: "date", required: false, editable: true },
          dueDate: { sourceField: "TargetDate", dataType: "date", required: false, editable: true },
          parentProjectRef: { sourceField: "ParentProject", dataType: "lookup", required: false, editable: true },
        },
        renderers: {},
        relations: {},
      },
    },
    views: [],
  } as unknown as WorkspaceConfig;
}

function makeGraphListItem(fields: Record<string, unknown> = {}): GraphListItem {
  return {
    id: "1",
    createdDateTime: "2026-01-15T10:00:00Z",
    lastModifiedDateTime: "2026-02-20T14:30:00Z",
    createdBy: {
      user: { id: "user-001", displayName: "Ada Lovelace", email: "ada@example.com" },
    },
    lastModifiedBy: {
      user: { id: "user-002", displayName: "Grace Hopper", email: "grace@example.com" },
    },
    fields,
  };
}

function makeColumn(overrides: Partial<GraphListColumnDefinition> = {}): GraphListColumnDefinition {
  return {
    id: "col-1",
    name: "TestColumn",
    displayName: "Test Column",
    dataType: "text",
    ...overrides,
  };
}

// ===========================================================================
// graphColumnDataTypeToWorkspaceFieldType
// ===========================================================================

describe("graphColumnDataTypeToWorkspaceFieldType", () => {
  it("maps text → string", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "text" }))).toBe("string");
  });

  it("maps note → text", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "note" }))).toBe("text");
  });

  it("maps number → number", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "number" }))).toBe("number");
  });

  it("maps boolean → boolean", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "boolean" }))).toBe("boolean");
  });

  it("maps dateTime → date", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "dateTime" }))).toBe("date");
  });

  it("maps person → person", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "person" }))).toBe("person");
  });

  it("maps person with multiValue → person-multi", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "person", multiValue: true }))).toBe("person-multi");
  });

  it("maps personMulti → person-multi", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "personMulti" }))).toBe("person-multi");
  });

  it("maps choice → choice", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "choice" }))).toBe("choice");
  });

  it("maps choice with multiValue → choice-multi", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "choice", multiValue: true }))).toBe("choice-multi");
  });

  it("maps choiceMulti → choice-multi", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "choiceMulti" }))).toBe("choice-multi");
  });

  it("maps lookup → lookup", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "lookup" }))).toBe("lookup");
  });

  it("maps lookup with multiValue → lookup-multi", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "lookup", multiValue: true }))).toBe("lookup-multi");
  });

  it("maps lookupMulti → lookup-multi", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "lookupMulti" }))).toBe("lookup-multi");
  });

  it("maps url → url", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "url" }))).toBe("url");
  });

  it("returns undefined for unknown type", () => {
    expect(graphColumnDataTypeToWorkspaceFieldType(makeColumn({ dataType: "unknown" }))).toBeUndefined();
  });
});

// ===========================================================================
// deriveFieldMappingFromColumn
// ===========================================================================

describe("deriveFieldMappingFromColumn", () => {
  it("derives a field mapping from a column", () => {
    const column = makeColumn({
      name: "TaskStatus",
      displayName: "Task Status",
      dataType: "choice",
      required: true,
      readOnly: false,
    });

    const mapping = deriveFieldMappingFromColumn(column);
    expect(mapping).toBeDefined();
    expect(mapping!.sourceField).toBe("TaskStatus");
    expect(mapping!.dataType).toBe("choice");
    expect(mapping!.required).toBe(true);
    expect(mapping!.editable).toBe(true);
  });

  it("marks readOnly columns as non-editable", () => {
    const column = makeColumn({ dataType: "number", readOnly: true });
    const mapping = deriveFieldMappingFromColumn(column);
    expect(mapping!.editable).toBe(false);
  });

  it("returns undefined for unknown column types", () => {
    const column = makeColumn({ dataType: "unknown" });
    expect(deriveFieldMappingFromColumn(column)).toBeUndefined();
  });

  it("uses displayName as description when different from name", () => {
    const column = makeColumn({ name: "TaskStatus", displayName: "Task Status" });
    const mapping = deriveFieldMappingFromColumn(column);
    expect(mapping!.description).toBe("Task Status");
  });

  it("omits description when displayName equals name", () => {
    const column = makeColumn({ name: "Title", displayName: "Title" });
    const mapping = deriveFieldMappingFromColumn(column);
    expect(mapping!.description).toBeUndefined();
  });
});

// ===========================================================================
// buildSourceFieldLookup
// ===========================================================================

describe("buildSourceFieldLookup", () => {
  it("builds a reverse lookup from sourceField → semanticField", () => {
    const config = makeTestConfig();
    const lookup = buildSourceFieldLookup(config.lists.tasks);

    expect(lookup.get("Title")).toBe("title");
    expect(lookup.get("TaskStatus")).toBe("status");
    expect(lookup.get("TaskPriority")).toBe("priority");
    expect(lookup.get("Body")).toBe("description");
    expect(lookup.get("AssignedTo")).toBe("assignee");
    expect(lookup.get("Tags")).toBe("labels");
  });

  it("returns undefined for unmapped source fields", () => {
    const config = makeTestConfig();
    const lookup = buildSourceFieldLookup(config.lists.tasks);
    expect(lookup.get("NonExistentField")).toBeUndefined();
  });
});

// ===========================================================================
// getConfiguredSourceFields / getConfiguredSemanticFields
// ===========================================================================

describe("getConfiguredSourceFields", () => {
  it("returns all configured source field names", () => {
    const config = makeTestConfig();
    const fields = getConfiguredSourceFields(config.lists.tasks);

    expect(fields.has("Title")).toBe(true);
    expect(fields.has("TaskStatus")).toBe(true);
    expect(fields.has("Tags")).toBe(true);
    expect(fields.has("SomeRandomField")).toBe(false);
  });
});

describe("getConfiguredSemanticFields", () => {
  it("returns all semantic field keys", () => {
    const config = makeTestConfig();
    const fields = getConfiguredSemanticFields(config.lists.tasks);

    expect(fields.has("title")).toBe(true);
    expect(fields.has("status")).toBe(true);
    expect(fields.has("priority")).toBe(true);
    expect(fields.has("labels")).toBe(true);
    expect(fields.size).toBe(10); // 10 task fields in test config
  });
});

// ===========================================================================
// detectCustomColumns
// ===========================================================================

describe("detectCustomColumns", () => {
  it("detects columns not in the config mapping", () => {
    const config = makeTestConfig();
    const columns: GraphListColumnDefinition[] = [
      makeColumn({ name: "Title", displayName: "Title", dataType: "text" }),
      makeColumn({ name: "CustomField1", displayName: "Custom Field 1", dataType: "text" }),
      makeColumn({ name: "CustomField2", displayName: "Custom Field 2", dataType: "number" }),
      makeColumn({ name: "TaskStatus", displayName: "Status", dataType: "choice" }),
    ];

    const custom = detectCustomColumns(config.lists.tasks, columns);
    expect(custom).toHaveLength(2);
    expect(custom.map((c) => c.name)).toContain("CustomField1");
    expect(custom.map((c) => c.name)).toContain("CustomField2");
  });

  it("excludes hidden columns", () => {
    const config = makeTestConfig();
    const columns: GraphListColumnDefinition[] = [
      makeColumn({ name: "HiddenField", displayName: "Hidden", dataType: "text", hidden: true }),
    ];

    const custom = detectCustomColumns(config.lists.tasks, columns);
    expect(custom).toHaveLength(0);
  });

  it("excludes known system columns", () => {
    const config = makeTestConfig();
    const columns: GraphListColumnDefinition[] = [
      makeColumn({ name: "ComplianceAssetId", displayName: "Compliance Asset Id", dataType: "text" }),
      makeColumn({ name: "Edit", displayName: "Edit", dataType: "text" }),
      makeColumn({ name: "LinkTitle", displayName: "Link Title", dataType: "text" }),
    ];

    const custom = detectCustomColumns(config.lists.tasks, columns);
    expect(custom).toHaveLength(0);
  });

  it("returns empty when all columns are mapped or system", () => {
    const config = makeTestConfig();
    const columns: GraphListColumnDefinition[] = [
      makeColumn({ name: "Title", displayName: "Title", dataType: "text" }),
      makeColumn({ name: "TaskStatus", displayName: "Status", dataType: "choice" }),
      makeColumn({ name: "Attachments", displayName: "Attachments", dataType: "text" }),
    ];

    const custom = detectCustomColumns(config.lists.tasks, columns);
    expect(custom).toHaveLength(0);
  });
});

// ===========================================================================
// getAllManagedSourceFields
// ===========================================================================

describe("getAllManagedSourceFields", () => {
  it("combines configured fields with internal columns for tasks", () => {
    const config = makeTestConfig();
    const allFields = getAllManagedSourceFields(config.lists.tasks, "tasks");

    // Config-mapped fields
    expect(allFields.has("Title")).toBe(true);
    expect(allFields.has("TaskStatus")).toBe(true);
    expect(allFields.has("Tags")).toBe(true);

    // Internal columns
    expect(allFields.has("TaskKey")).toBe(true);
    expect(allFields.has("ChecklistData")).toBe(true);
    expect(allFields.has("SortOrder")).toBe(true);
  });

  it("combines configured fields with internal columns for projects", () => {
    const config = makeTestConfig();
    const allFields = getAllManagedSourceFields(config.lists.projects, "projects");

    // Config-mapped
    expect(allFields.has("Title")).toBe(true);
    expect(allFields.has("ProjectStatus")).toBe(true);

    // Internal
    expect(allFields.has("ProjectHealth")).toBe(true);
    expect(allFields.has("MilestoneData")).toBe(true);
    expect(allFields.has("TaskCount")).toBe(true);
  });
});

// ===========================================================================
// Reverse normalization maps
// ===========================================================================

describe("reverse normalization maps", () => {
  it("maps all task status values", () => {
    expect(Object.keys(TASK_STATUS_TO_SHAREPOINT)).toEqual(
      expect.arrayContaining(["backlog", "planned", "in-progress", "blocked", "in-review", "done"]),
    );
  });

  it("maps all task priority values", () => {
    expect(Object.keys(TASK_PRIORITY_TO_SHAREPOINT)).toEqual(
      expect.arrayContaining(["low", "medium", "high", "urgent"]),
    );
  });

  it("maps all project status values", () => {
    expect(Object.keys(PROJECT_STATUS_TO_SHAREPOINT)).toEqual(
      expect.arrayContaining(["planned", "active", "blocked", "on-hold", "complete"]),
    );
  });

  it("maps all project health values", () => {
    expect(Object.keys(PROJECT_HEALTH_TO_SHAREPOINT)).toEqual(
      expect.arrayContaining(["on-track", "at-risk", "off-track", "done"]),
    );
  });
});

// ===========================================================================
// SchemaMapper — construction and introspection
// ===========================================================================

describe("SchemaMapper — introspection", () => {
  const config = makeTestConfig();

  it("creates mapper for tasks scope", () => {
    const mapper = createSchemaMapper(config, "tasks");
    expect(mapper.semanticFields).toContain("title");
    expect(mapper.semanticFields).toContain("status");
    expect(mapper.semanticFields).toContain("labels");
  });

  it("creates mapper for projects scope", () => {
    const mapper = createSchemaMapper(config, "projects");
    expect(mapper.semanticFields).toContain("title");
    expect(mapper.semanticFields).toContain("projectCode");
    expect(mapper.semanticFields).toContain("parentProjectRef");
  });

  it("resolves source field from semantic field", () => {
    const mapper = createSchemaMapper(config, "tasks");
    expect(mapper.sourceFieldForSemantic("title")).toBe("Title");
    expect(mapper.sourceFieldForSemantic("status")).toBe("TaskStatus");
    expect(mapper.sourceFieldForSemantic("labels")).toBe("Tags");
    expect(mapper.sourceFieldForSemantic("nonexistent")).toBeUndefined();
  });

  it("resolves semantic field from source field", () => {
    const mapper = createSchemaMapper(config, "tasks");
    expect(mapper.semanticFieldForSource("Title")).toBe("title");
    expect(mapper.semanticFieldForSource("TaskStatus")).toBe("status");
    expect(mapper.semanticFieldForSource("Tags")).toBe("labels");
    expect(mapper.semanticFieldForSource("NonExistent")).toBeUndefined();
  });

  it("reports configured source fields", () => {
    const mapper = createSchemaMapper(config, "tasks");
    expect(mapper.isConfiguredSourceField("Title")).toBe(true);
    expect(mapper.isConfiguredSourceField("NonExistent")).toBe(false);
  });

  it("reports internal columns", () => {
    const taskMapper = createSchemaMapper(config, "tasks");
    expect(taskMapper.isInternalColumn("TaskKey")).toBe(true);
    expect(taskMapper.isInternalColumn("ChecklistData")).toBe(true);
    expect(taskMapper.isInternalColumn("Title")).toBe(false);

    const projectMapper = createSchemaMapper(config, "projects");
    expect(projectMapper.isInternalColumn("ProjectHealth")).toBe(true);
    expect(projectMapper.isInternalColumn("MilestoneData")).toBe(true);
  });

  it("returns field mapping config", () => {
    const mapper = createSchemaMapper(config, "tasks");
    const titleMapping = mapper.fieldMapping("title");
    expect(titleMapping).toBeDefined();
    expect(titleMapping!.sourceField).toBe("Title");
    expect(titleMapping!.dataType).toBe("string");
  });

  it("lists all source fields", () => {
    const mapper = createSchemaMapper(config, "tasks");
    expect(mapper.sourceFields).toContain("Title");
    expect(mapper.sourceFields).toContain("TaskStatus");
    expect(mapper.sourceFields).toContain("Tags");
  });
});

// ===========================================================================
// SchemaMapper — read direction
// ===========================================================================

describe("SchemaMapper — read direction", () => {
  const config = makeTestConfig();

  it("reads field value by semantic key", () => {
    const mapper = createSchemaMapper(config, "tasks");
    const item = makeGraphListItem({
      Title: "Fix login bug",
      TaskStatus: "In Progress",
      Tags: "frontend; bug",
    });

    expect(mapper.readFieldValue(item, "title")).toBe("Fix login bug");
    expect(mapper.readFieldValue(item, "status")).toBe("In Progress");
    expect(mapper.readFieldValue(item, "labels")).toBe("frontend; bug");
  });

  it("returns undefined for unmapped semantic field", () => {
    const mapper = createSchemaMapper(config, "tasks");
    const item = makeGraphListItem();
    expect(mapper.readFieldValue(item, "nonexistent")).toBeUndefined();
  });

  it("reads custom columns from item", () => {
    const mapper = createSchemaMapper(config, "tasks");
    const item = makeGraphListItem({
      Title: "Task",
      CustomField1: "custom value",
      AnotherCustom: 42,
    });

    const custom = mapper.readCustomColumns(item);
    expect(custom.CustomField1).toBe("custom value");
    expect(custom.AnotherCustom).toBe(42);
    // Title should NOT be in custom columns (it's a mapped field)
    expect(custom.Title).toBeUndefined();
  });

  it("excludes internal columns from custom columns", () => {
    const mapper = createSchemaMapper(config, "tasks");
    const item = makeGraphListItem({
      TaskKey: "T-42",
      ChecklistData: "[]",
      SortOrder: 5,
      TrulyCustom: "yes",
    });

    const custom = mapper.readCustomColumns(item);
    expect(custom.TrulyCustom).toBe("yes");
    expect(custom.TaskKey).toBeUndefined();
    expect(custom.ChecklistData).toBeUndefined();
    expect(custom.SortOrder).toBeUndefined();
  });

  it("returns empty object when no custom columns", () => {
    const mapper = createSchemaMapper(config, "tasks");
    const item = makeGraphListItem({ Title: "Task", TaskStatus: "Active" });
    const custom = mapper.readCustomColumns(item);
    expect(Object.keys(custom)).toHaveLength(0);
  });
});

// ===========================================================================
// SchemaMapper — write direction: task updates
// ===========================================================================

describe("SchemaMapper — task write direction", () => {
  const config = makeTestConfig();
  const mapper = createSchemaMapper(config, "tasks");

  it("maps a simple title update", () => {
    const payload = mapper.mapTaskUpdateToFields({ title: "New title" });
    expect(payload.fields.Title).toBe("New title");
    expect(payload.mappedFields).toContain("title");
  });

  it("maps status with reverse normalization", () => {
    const payload = mapper.mapTaskUpdateToFields({ status: "in-progress" });
    expect(payload.fields.TaskStatus).toBe("In Progress");
    expect(payload.mappedFields).toContain("status");
  });

  it("maps all task status values", () => {
    const cases: Array<[string, string]> = [
      ["backlog", "Backlog"],
      ["planned", "Not Started"],
      ["in-progress", "In Progress"],
      ["blocked", "Blocked"],
      ["in-review", "In Review"],
      ["done", "Done"],
    ];

    for (const [piperStatus, sharepointStatus] of cases) {
      const payload = mapper.mapTaskUpdateToFields({ status: piperStatus });
      expect(payload.fields.TaskStatus, `${piperStatus} → ${sharepointStatus}`).toBe(sharepointStatus);
    }
  });

  it("maps priority with reverse normalization", () => {
    const payload = mapper.mapTaskUpdateToFields({ priority: "high" });
    expect(payload.fields.TaskPriority).toBe("High");
  });

  it("maps all task priority values", () => {
    const cases: Array<[string, string]> = [
      ["low", "Low"],
      ["medium", "Medium"],
      ["high", "High"],
      ["urgent", "Urgent"],
    ];

    for (const [piperPriority, sharepointPriority] of cases) {
      const payload = mapper.mapTaskUpdateToFields({ priority: piperPriority });
      expect(payload.fields.TaskPriority, `${piperPriority} → ${sharepointPriority}`).toBe(sharepointPriority);
    }
  });

  it("maps description update", () => {
    const payload = mapper.mapTaskUpdateToFields({ description: "Updated description" });
    expect(payload.fields.Body).toBe("Updated description");
  });

  it("maps assignee as person field", () => {
    const payload = mapper.mapTaskUpdateToFields({
      assignee: { displayName: "Jane Smith", email: "jane@example.com", externalId: "42" },
    });
    const personValue = payload.fields.AssignedTo as Record<string, unknown>;
    expect(personValue).toBeDefined();
    expect(personValue.DisplayName).toBe("Jane Smith");
    expect(personValue.Email).toBe("jane@example.com");
  });

  it("maps date fields", () => {
    const payload = mapper.mapTaskUpdateToFields({
      startDate: "2026-04-01",
      dueDate: "2026-06-30",
    });
    expect(payload.fields.StartDate).toBe("2026-04-01");
    expect(payload.fields.DueDate).toBe("2026-06-30");
  });

  it("maps labels array to semicolon-separated string", () => {
    const payload = mapper.mapTaskUpdateToFields({ labels: ["frontend", "bug", "priority"] });
    expect(payload.fields.Tags).toBe("frontend; bug; priority");
  });

  it("maps empty labels array", () => {
    const payload = mapper.mapTaskUpdateToFields({ labels: [] });
    expect(payload.fields.Tags).toBe("");
  });

  it("maps project lookup reference", () => {
    const payload = mapper.mapTaskUpdateToFields({
      projectRef: { lookupId: 5, lookupValue: "ALPHA" },
    });
    const lookup = payload.fields.ProjectLookup as Record<string, unknown>;
    expect(lookup.LookupId).toBe(5);
    expect(lookup.LookupValue).toBe("ALPHA");
  });

  it("maps parent task lookup reference", () => {
    const payload = mapper.mapTaskUpdateToFields({
      parentTaskRef: { lookupId: 99, lookupValue: "Parent task" },
    });
    const lookup = payload.fields.ParentTask as Record<string, unknown>;
    expect(lookup.LookupId).toBe(99);
  });

  it("passes through custom columns from existing item", () => {
    const existingItem = makeGraphListItem({
      Title: "Old title",
      CustomField1: "preserve me",
      CustomNumber: 42,
    });

    const payload = mapper.mapTaskUpdateToFields({ title: "New title" }, existingItem);
    expect(payload.fields.Title).toBe("New title");
    expect(payload.fields.CustomField1).toBe("preserve me");
    expect(payload.fields.CustomNumber).toBe(42);
    expect(payload.passthroughFields).toContain("CustomField1");
    expect(payload.passthroughFields).toContain("CustomNumber");
  });

  it("does not overwrite mapped fields with passthrough", () => {
    const existingItem = makeGraphListItem({
      Title: "Old title",
      TaskStatus: "Old status",
    });

    const payload = mapper.mapTaskUpdateToFields({ title: "New title" }, existingItem);
    expect(payload.fields.Title).toBe("New title");
    // TaskStatus was not in the update, so it should NOT appear in passthrough
    // because it's a configured source field
    expect(payload.passthroughFields).not.toContain("TaskStatus");
  });

  it("skips undefined values in updates", () => {
    const payload = mapper.mapTaskUpdateToFields({ title: undefined });
    expect(payload.fields.Title).toBeUndefined();
    expect(payload.mappedFields).not.toContain("title");
  });

  it("handles multiple field updates at once", () => {
    const payload = mapper.mapTaskUpdateToFields({
      title: "Updated task",
      status: "done",
      priority: "high",
      startDate: "2026-04-01",
      labels: ["backend"],
    });
    expect(payload.fields.Title).toBe("Updated task");
    expect(payload.fields.TaskStatus).toBe("Done");
    expect(payload.fields.TaskPriority).toBe("High");
    expect(payload.fields.StartDate).toBe("2026-04-01");
    expect(payload.fields.Tags).toBe("backend");
    expect(payload.mappedFields).toHaveLength(5);
  });
});

// ===========================================================================
// SchemaMapper — write direction: project updates
// ===========================================================================

describe("SchemaMapper — project write direction", () => {
  const config = makeTestConfig();
  const mapper = createSchemaMapper(config, "projects");

  it("maps project title update", () => {
    const payload = mapper.mapProjectUpdateToFields({ title: "New project title" });
    expect(payload.fields.Title).toBe("New project title");
  });

  it("maps project status with reverse normalization", () => {
    const cases: Array<[string, string]> = [
      ["planned", "Planned"],
      ["active", "Active"],
      ["blocked", "Blocked"],
      ["on-hold", "On Hold"],
      ["complete", "Done"],
    ];

    for (const [piperStatus, sharepointStatus] of cases) {
      const payload = mapper.mapProjectUpdateToFields({ status: piperStatus });
      expect(payload.fields.ProjectStatus, `${piperStatus} → ${sharepointStatus}`).toBe(sharepointStatus);
    }
  });

  it("maps project owner as person field", () => {
    const payload = mapper.mapProjectUpdateToFields({
      owner: { displayName: "Jane Smith", email: "jane@example.com", externalId: "42" },
    });
    const personValue = payload.fields.ProjectOwner as Record<string, unknown>;
    expect(personValue.DisplayName).toBe("Jane Smith");
    expect(personValue.Email).toBe("jane@example.com");
  });

  it("maps project code update", () => {
    const payload = mapper.mapProjectUpdateToFields({ projectCode: "PLATFORM-02" });
    expect(payload.fields.ProjectCode).toBe("PLATFORM-02");
  });

  it("maps project date fields to correct source fields", () => {
    const payload = mapper.mapProjectUpdateToFields({
      startDate: "2026-01-01",
      dueDate: "2026-06-30",
    });
    expect(payload.fields.StartDate).toBe("2026-01-01");
    expect(payload.fields.TargetDate).toBe("2026-06-30");
  });

  it("maps parent project lookup reference", () => {
    const payload = mapper.mapProjectUpdateToFields({
      parentProjectRef: { lookupId: 3, lookupValue: "Parent Program" },
    });
    const lookup = payload.fields.ParentProject as Record<string, unknown>;
    expect(lookup.LookupId).toBe(3);
    expect(lookup.LookupValue).toBe("Parent Program");
  });

  it("passes through custom columns from existing project item", () => {
    const existingItem = makeGraphListItem({
      Title: "Old project",
      CustomBudget: 50000,
      CustomRisk: "Medium",
    });

    const payload = mapper.mapProjectUpdateToFields({ title: "New project" }, existingItem);
    expect(payload.fields.Title).toBe("New project");
    expect(payload.fields.CustomBudget).toBe(50000);
    expect(payload.fields.CustomRisk).toBe("Medium");
  });
});

// ===========================================================================
// SchemaMapper — write direction: internal fields
// ===========================================================================

describe("SchemaMapper — internal field mapping", () => {
  const config = makeTestConfig();
  const mapper = createSchemaMapper(config, "tasks");

  it("JSON-serializes checklist data", () => {
    const fields = mapper.mapInternalFields({
      ChecklistData: [{ id: "1", title: "Step 1", completed: false }],
    }, "tasks");
    expect(typeof fields.ChecklistData).toBe("string");
    const parsed = JSON.parse(fields.ChecklistData as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Step 1");
  });

  it("JSON-serializes attachment data", () => {
    const fields = mapper.mapInternalFields({
      AttachmentLinks: [{ id: "a1", name: "file.pdf", url: "https://example.com/file.pdf" }],
    }, "tasks");
    const parsed = JSON.parse(fields.AttachmentLinks as string);
    expect(parsed[0].name).toBe("file.pdf");
  });

  it("maps primitive internal fields", () => {
    const fields = mapper.mapInternalFields({
      TaskKey: "T-42",
      SortOrder: 5,
      EstimatePoints: 8,
    }, "tasks");
    expect(fields.TaskKey).toBe("T-42");
    expect(fields.SortOrder).toBe(5);
    expect(fields.EstimatePoints).toBe(8);
  });

  it("maps project internal fields", () => {
    const projectMapper = createSchemaMapper(config, "projects");
    const fields = projectMapper.mapInternalFields({
      ProjectHealth: "On Track",
      ProgressPercent: 75,
    }, "projects");
    expect(fields.ProjectHealth).toBe("On Track");
    expect(fields.ProgressPercent).toBe(75);
  });

  it("JSON-serializes milestone data", () => {
    const projectMapper = createSchemaMapper(config, "projects");
    const fields = projectMapper.mapInternalFields({
      MilestoneData: [{ id: "m1", title: "Phase 1", date: "2026-06-01" }],
    }, "projects");
    const parsed = JSON.parse(fields.MilestoneData as string);
    expect(parsed[0].title).toBe("Phase 1");
  });

  it("skips undefined internal fields", () => {
    const fields = mapper.mapInternalFields({
      TaskKey: undefined,
      SortOrder: 3,
    }, "tasks");
    expect(fields.TaskKey).toBeUndefined();
    expect(fields.SortOrder).toBe(3);
  });

  it("ignores fields not in internal column registry", () => {
    const fields = mapper.mapInternalFields({
      SomeRandomField: "value",
    }, "tasks");
    expect(fields.SomeRandomField).toBeUndefined();
  });
});

// ===========================================================================
// SchemaMapper — end-to-end: read → modify → write roundtrip
// ===========================================================================

describe("SchemaMapper — roundtrip scenarios", () => {
  const config = makeTestConfig();
  const taskMapper = createSchemaMapper(config, "tasks");
  const projectMapper = createSchemaMapper(config, "projects");

  it("round-trips a task status change", () => {
    // Read: status comes as "In Progress" from Graph
    const item = makeGraphListItem({ TaskStatus: "In Progress", Title: "My task" });
    const rawStatus = taskMapper.readFieldValue(item, "status");
    expect(rawStatus).toBe("In Progress");

    // Write: map Piper status back to SharePoint
    const payload = taskMapper.mapTaskUpdateToFields({ status: "done" });
    expect(payload.fields.TaskStatus).toBe("Done");
  });

  it("round-trips a project with custom columns preserved", () => {
    // Simulate a project item with custom columns
    const existingItem = makeGraphListItem({
      Title: "Platform Redesign",
      ProjectStatus: "Active",
      CustomBudget: 100000,
      CustomSponsor: "VP Engineering",
    });

    // Read: verify custom columns are detected
    const custom = projectMapper.readCustomColumns(existingItem);
    expect(custom.CustomBudget).toBe(100000);
    expect(custom.CustomSponsor).toBe("VP Engineering");

    // Write: update title and status, custom columns pass through
    const payload = projectMapper.mapProjectUpdateToFields(
      { title: "Platform Redesign v2", status: "complete" },
      existingItem,
    );
    expect(payload.fields.Title).toBe("Platform Redesign v2");
    expect(payload.fields.ProjectStatus).toBe("Done");
    expect(payload.fields.CustomBudget).toBe(100000);
    expect(payload.fields.CustomSponsor).toBe("VP Engineering");
  });

  it("round-trips labels: read semicolons → write semicolons", () => {
    const item = makeGraphListItem({ Tags: "frontend; bug" });
    const rawLabels = taskMapper.readFieldValue(item, "labels");
    expect(rawLabels).toBe("frontend; bug");

    const payload = taskMapper.mapTaskUpdateToFields({ labels: ["frontend", "bug", "urgent"] });
    expect(payload.fields.Tags).toBe("frontend; bug; urgent");
  });

  it("round-trips task with all configured fields", () => {
    const existingItem = makeGraphListItem({
      Title: "Complete feature",
      TaskStatus: "In Progress",
      TaskPriority: "High",
      Body: "Detailed description",
      StartDate: "2026-01-01",
      DueDate: "2026-03-15",
      Tags: "feature; backend",
    });

    const payload = taskMapper.mapTaskUpdateToFields(
      {
        title: "Complete feature (updated)",
        status: "in-review",
        priority: "medium",
        description: "Updated description",
        startDate: "2026-02-01",
        dueDate: "2026-04-15",
        labels: ["feature", "backend", "review"],
      },
      existingItem,
    );

    expect(payload.fields.Title).toBe("Complete feature (updated)");
    expect(payload.fields.TaskStatus).toBe("In Review");
    expect(payload.fields.TaskPriority).toBe("Medium");
    expect(payload.fields.Body).toBe("Updated description");
    expect(payload.fields.StartDate).toBe("2026-02-01");
    expect(payload.fields.DueDate).toBe("2026-04-15");
    expect(payload.fields.Tags).toBe("feature; backend; review");
  });
});

// ===========================================================================
// PIPER_INTERNAL_COLUMNS structure
// ===========================================================================

describe("PIPER_INTERNAL_COLUMNS", () => {
  it("defines task internal columns", () => {
    const taskColumns = PIPER_INTERNAL_COLUMNS.tasks;
    expect(taskColumns.TaskKey).toBeDefined();
    expect(taskColumns.ChecklistData).toBeDefined();
    expect(taskColumns.SortOrder).toBeDefined();
    expect(taskColumns.Reporter).toBeDefined();
    expect(taskColumns.Watchers).toBeDefined();
  });

  it("defines project internal columns", () => {
    const projectColumns = PIPER_INTERNAL_COLUMNS.projects;
    expect(projectColumns.ProjectHealth).toBeDefined();
    expect(projectColumns.MilestoneData).toBeDefined();
    expect(projectColumns.ProgressPercent).toBeDefined();
    expect(projectColumns.TaskCount).toBeDefined();
  });

  it("marks TaskCount as non-editable aggregate", () => {
    expect(PIPER_INTERNAL_COLUMNS.projects.TaskCount.editable).toBe(false);
    expect(PIPER_INTERNAL_COLUMNS.projects.OpenTaskCount.editable).toBe(false);
  });
});
