import { describe, expect, it } from "vitest";
import { MsListsSchemaMapper } from "../ms-lists-schema-mapper";
import { coreOpsWorkspaceFixture } from "@/features/workspaces/fixtures";
import {
  mockGraphTaskItems,
  mockGraphProjectItems,
  mockGraphCommentsByItemId,
} from "@/lib/graph/mock-graph-payloads";
import type { FieldMappingConfig } from "../../schema-mapper";
import type { GraphListColumnDefinition } from "@/lib/graph/types";

function createMapper() {
  return new MsListsSchemaMapper({
    workspaceConfig: coreOpsWorkspaceFixture,
  });
}

/**
 * Build a FieldMappingConfig from the workspace fixture's task fields.
 * This mirrors what the existing workspace config already provides.
 */
function taskFieldMappingConfig(): FieldMappingConfig {
  const fields: FieldMappingConfig["fields"] = {};
  for (const [key, value] of Object.entries(coreOpsWorkspaceFixture.lists.tasks.fields)) {
    fields[key] = {
      sourceField: value.sourceField,
      dataType: value.dataType,
      required: value.required,
      editable: value.editable,
    };
  }
  return { fields, renderers: {}, relations: {} };
}

function projectFieldMappingConfig(): FieldMappingConfig {
  const fields: FieldMappingConfig["fields"] = {};
  for (const [key, value] of Object.entries(coreOpsWorkspaceFixture.lists.projects.fields)) {
    fields[key] = {
      sourceField: value.sourceField,
      dataType: value.dataType,
      required: value.required,
      editable: value.editable,
    };
  }
  return { fields, renderers: {}, relations: {} };
}

describe("MsListsSchemaMapper", () => {
  describe("backendId", () => {
    it("is 'ms-lists'", () => {
      expect(createMapper().backendId).toBe("ms-lists");
    });
  });

  describe("toTask", () => {
    it("maps a Graph list item to a WorkspaceTask", () => {
      const mapper = createMapper();
      const graphItem = mockGraphTaskItems[0];
      const task = mapper.toTask(graphItem, taskFieldMappingConfig());

      expect(task.title).toBeTruthy();
      expect(task.status).toBeTruthy();
      expect(task.createdAt).toBeTruthy();
      expect(task.id).toBeTruthy();
      expect(task.workspaceId).toBe(coreOpsWorkspaceFixture.workspace.id);
    });

    it("maps all mock task items without error", () => {
      const mapper = createMapper();
      const config = taskFieldMappingConfig();

      for (const item of mockGraphTaskItems) {
        const task = mapper.toTask(item, config);
        expect(task.id).toBeTruthy();
        expect(typeof task.title).toBe("string");
      }
    });
  });

  describe("toProject", () => {
    it("maps a Graph list item to a WorkspaceProject", () => {
      const mapper = createMapper();
      const graphItem = mockGraphProjectItems[0];
      const project = mapper.toProject(graphItem, projectFieldMappingConfig());

      expect(project.title).toBeTruthy();
      expect(project.status).toBeTruthy();
      expect(project.id).toBeTruthy();
      expect(project.workspaceId).toBe(coreOpsWorkspaceFixture.workspace.id);
    });

    it("maps all mock project items without error", () => {
      const mapper = createMapper();
      const config = projectFieldMappingConfig();

      for (const item of mockGraphProjectItems) {
        const project = mapper.toProject(item, config);
        expect(project.id).toBeTruthy();
        expect(typeof project.title).toBe("string");
      }
    });
  });

  describe("toComment", () => {
    it("maps a Graph comment to a CommentRef", () => {
      const mapper = createMapper();
      const firstItemId = Object.keys(mockGraphCommentsByItemId)[0];
      const graphComments = mockGraphCommentsByItemId[firstItemId];

      if (!graphComments || graphComments.length === 0) {
        // Skip if no mock comments available
        return;
      }

      const comment = mapper.toComment(graphComments[0], {
        listId: coreOpsWorkspaceFixture.lists.tasks.list.id,
        itemId: firstItemId,
        entityType: "task",
      });

      expect(comment.id).toBeTruthy();
      expect(comment.body).toBeTruthy();
      expect(comment.entityType).toBe("task");
    });
  });

  describe("fromTaskPatch", () => {
    it("maps status back to Graph field name", () => {
      const mapper = createMapper();
      const config = taskFieldMappingConfig();

      const result = mapper.fromTaskPatch(
        { status: "in-progress" },
        config,
      );

      expect((result as any).fields.TaskStatus).toBe("In Progress");
    });

    it("maps priority back to Graph field name", () => {
      const mapper = createMapper();
      const config = taskFieldMappingConfig();

      const result = mapper.fromTaskPatch(
        { priority: "high" },
        config,
      );

      expect((result as any).fields.Priority).toBe("High");
    });

    it("maps title back to Graph field name", () => {
      const mapper = createMapper();
      const config = taskFieldMappingConfig();

      const result = mapper.fromTaskPatch(
        { title: "Updated Title" },
        config,
      );

      expect((result as any).fields.Title).toBe("Updated Title");
    });

    it("does not include fields not in the patch", () => {
      const mapper = createMapper();
      const config = taskFieldMappingConfig();

      const result = mapper.fromTaskPatch({ title: "Only Title" }, config);
      const fields = (result as any).fields;

      // Title should be set
      expect(fields.Title).toBe("Only Title");
      // Status should not be set (not in patch)
      expect(fields.TaskStatus).toBeUndefined();
    });
  });

  describe("fromCreateTask", () => {
    it("maps create input to Graph item with defaults", () => {
      const mapper = createMapper();
      const config = taskFieldMappingConfig();

      const result = mapper.fromCreateTask(
        { title: "New Task" },
        config,
      );

      expect(result.fields.Title).toBe("New Task");
      expect(result.fields.TaskStatus).toBe("Not Started");
      expect(result.fields.Priority).toBe("Medium");
    });

    it("maps create input with explicit values", () => {
      const mapper = createMapper();
      const config = taskFieldMappingConfig();

      const result = mapper.fromCreateTask(
        {
          title: "Urgent Bug",
          status: "in-progress",
          priority: "urgent",
          dueDate: "2026-12-31",
          labels: ["bug", "critical"],
        },
        config,
      );

      expect(result.fields.Title).toBe("Urgent Bug");
      expect(result.fields.TaskStatus).toBe("In Progress");
      expect(result.fields.Priority).toBe("Urgent");
      expect(result.fields.DueDate).toBe("2026-12-31");
      expect(result.fields.Tags).toEqual(["bug", "critical"]);
    });
  });

  describe("fromCreateComment", () => {
    it("formats a comment for the Graph API", () => {
      const mapper = createMapper();
      const result = mapper.fromCreateComment({
        entityType: "task",
        entityId: "task-1",
        body: "Hello world",
        bodyFormat: "html",
      }) as any;

      expect(result.body.content).toBe("Hello world");
      expect(result.body.contentType).toBe("html");
    });

    it("defaults to text content type", () => {
      const mapper = createMapper();
      const result = mapper.fromCreateComment({
        entityType: "task",
        entityId: "task-1",
        body: "Plain text",
      }) as any;

      expect(result.body.contentType).toBe("text");
    });
  });

  describe("validateConfig", () => {
    it("passes for a valid config with matching columns", () => {
      const mapper = createMapper();
      const config = taskFieldMappingConfig();
      const columns: GraphListColumnDefinition[] = [
        { id: "1", name: "ID", displayName: "ID", dataType: "number", required: true },
        { id: "2", name: "Title", displayName: "Title", dataType: "text", required: true },
        { id: "3", name: "TaskStatus", displayName: "Task Status", dataType: "choice" },
        { id: "4", name: "Priority", displayName: "Priority", dataType: "choice" },
        { id: "5", name: "AssignedTo", displayName: "Assigned To", dataType: "person" },
        { id: "6", name: "TaskDetails", displayName: "Task Details", dataType: "note" },
        { id: "7", name: "Project", displayName: "Project", dataType: "lookup" },
        { id: "8", name: "ParentTask", displayName: "Parent Task", dataType: "lookup" },
        { id: "9", name: "Predecessors", displayName: "Predecessors", dataType: "lookupMulti" },
        { id: "10", name: "StartDate", displayName: "Start Date", dataType: "dateTime" },
        { id: "11", name: "DueDate", displayName: "Due Date", dataType: "dateTime" },
        { id: "12", name: "Tags", displayName: "Tags", dataType: "choiceMulti" },
      ];

      const result = mapper.validateConfig(config, columns);
      expect(result.valid).toBe(true);
    });

    it("reports missing source fields", () => {
      const mapper = createMapper();
      const config = taskFieldMappingConfig();
      // Provide empty column list — all source fields are missing
      const result = mapper.validateConfig(config, []);

      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.severity === "error")).toBe(true);
    });

    it("reports missing required semantic fields", () => {
      const mapper = createMapper();
      // Config with no title or status
      const config: FieldMappingConfig = {
        fields: {
          description: { sourceField: "Notes", dataType: "text" },
        },
        renderers: {},
        relations: {},
      };

      const columns: GraphListColumnDefinition[] = [
        { id: "1", name: "Notes", displayName: "Notes", dataType: "note" },
      ];

      const result = mapper.validateConfig(config, columns);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.field === "title")).toBe(true);
      expect(result.issues.some((i) => i.field === "status")).toBe(true);
    });

    it("warns on type mismatches", () => {
      const mapper = createMapper();
      const config: FieldMappingConfig = {
        fields: {
          title: { sourceField: "Title", dataType: "string" },
          status: { sourceField: "Status", dataType: "choice" },
        },
        renderers: {},
        relations: {},
      };

      // Status is mapped as "choice" but the Graph column is "number"
      const columns: GraphListColumnDefinition[] = [
        { id: "1", name: "Title", displayName: "Title", dataType: "text" },
        { id: "2", name: "Status", displayName: "Status", dataType: "number" },
      ];

      const result = mapper.validateConfig(config, columns);
      // Should still be valid (warnings, not errors) but with issues
      expect(result.issues.some((i) => i.severity === "warning" && i.field === "status")).toBe(true);
    });
  });
});
