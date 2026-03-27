/* eslint-disable @typescript-eslint/no-explicit-any -- test file uses any for mock implementations */
import { describe, it, expect, vi } from "vitest";
import type { WorkspaceConfig } from "@/features/workspaces/types";
import type { GraphClient } from "@/lib/graph/graph-client";
import type { GraphListColumnDefinition } from "@/lib/graph/types";
import { validateWorkspaceConfigAgainstGraph } from "@/lib/graph/validate-workspace-config";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(fieldOverrides?: {
  tasks?: Record<string, string>;
  projects?: Record<string, string>;
}): WorkspaceConfig {
  return {
    version: 1,
    workspace: {
      id: "ws-1",
      label: "Test",
      description: "",
      tenant: { id: "t-1", label: "T", domain: "t.com" },
    },
    lists: {
      tasks: {
        site: { id: "site-t", label: "Tasks" },
        list: { id: "list-t", label: "Tasks" },
        fields: {
          title: { sourceField: fieldOverrides?.tasks?.title ?? "Title", dataType: "string", required: true, editable: true },
          status: { sourceField: fieldOverrides?.tasks?.status ?? "TaskStatus", dataType: "choice", required: true, editable: true },
          priority: { sourceField: fieldOverrides?.tasks?.priority ?? "Priority", dataType: "choice", required: true, editable: true },
        },
        renderers: {},
        relations: {},
      },
      projects: {
        site: { id: "site-p", label: "Projects" },
        list: { id: "list-p", label: "Projects" },
        fields: {
          title: { sourceField: fieldOverrides?.projects?.title ?? "Title", dataType: "string", required: true, editable: true },
          status: { sourceField: fieldOverrides?.projects?.status ?? "ProjectStatus", dataType: "choice", required: true, editable: true },
        },
        renderers: {},
        relations: {},
      },
    },
    views: [],
  } as unknown as WorkspaceConfig;
}

function makeColumnClient(columns: {
  tasks: GraphListColumnDefinition[];
  projects: GraphListColumnDefinition[];
}): GraphClient {
  return {
    getListMetadata: vi.fn().mockResolvedValue({ displayName: "Mock" }),
    listColumns: vi.fn().mockImplementation((req: any) => {
      if (req.listId === "list-t") {
        return Promise.resolve({ value: columns.tasks });
      }
      if (req.listId === "list-p") {
        return Promise.resolve({ value: columns.projects });
      }
      return Promise.resolve({ value: [] });
    }),
    listItems: vi.fn().mockResolvedValue({ value: [] }),
    listComments: vi.fn().mockResolvedValue({ value: [] }),
  };
}

function column(name: string): GraphListColumnDefinition {
  return {
    id: `col-${name}`,
    name,
    displayName: name,
    dataType: "text",
  };
}

// ===========================================================================
// validateWorkspaceConfigAgainstGraph
// ===========================================================================

describe("validateWorkspaceConfigAgainstGraph", () => {
  it("returns ok when all source fields match columns", async () => {
    const client = makeColumnClient({
      tasks: [column("Title"), column("TaskStatus"), column("Priority")],
      projects: [column("Title"), column("ProjectStatus")],
    });

    const result = await validateWorkspaceConfigAgainstGraph(makeConfig(), client);

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("reports issues for missing task columns", async () => {
    const client = makeColumnClient({
      tasks: [column("Title")], // missing TaskStatus and Priority
      projects: [column("Title"), column("ProjectStatus")],
    });

    const result = await validateWorkspaceConfigAgainstGraph(makeConfig(), client);

    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].scope).toBe("tasks");
    expect(result.issues[0].sourceField).toBe("TaskStatus");
    expect(result.issues[1].sourceField).toBe("Priority");
  });

  it("reports issues for missing project columns", async () => {
    const client = makeColumnClient({
      tasks: [column("Title"), column("TaskStatus"), column("Priority")],
      projects: [column("Title")], // missing ProjectStatus
    });

    const result = await validateWorkspaceConfigAgainstGraph(makeConfig(), client);

    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].scope).toBe("projects");
    expect(result.issues[0].sourceField).toBe("ProjectStatus");
  });

  it("reports issues across both scopes", async () => {
    const client = makeColumnClient({
      tasks: [], // all missing
      projects: [], // all missing
    });

    const result = await validateWorkspaceConfigAgainstGraph(makeConfig(), client);

    expect(result.ok).toBe(false);
    // tasks: title + status + priority = 3, projects: title + status = 2
    expect(result.issues).toHaveLength(5);
  });

  it("includes semanticField and sourceField in each issue", async () => {
    const client = makeColumnClient({
      tasks: [],
      projects: [column("Title"), column("ProjectStatus")],
    });

    const result = await validateWorkspaceConfigAgainstGraph(makeConfig(), client);

    for (const issue of result.issues) {
      expect(issue.semanticField).toBeDefined();
      expect(issue.sourceField).toBeDefined();
      expect(issue.message).toContain(issue.sourceField);
    }
  });

  it("validates using the configured sourceField, not semantic name", async () => {
    const config = makeConfig({
      tasks: { title: "CustomTitleField", status: "CustomStatus", priority: "CustomPrio" },
    });

    const client = makeColumnClient({
      tasks: [column("CustomTitleField"), column("CustomStatus"), column("CustomPrio")],
      projects: [column("Title"), column("ProjectStatus")],
    });

    const result = await validateWorkspaceConfigAgainstGraph(config, client);
    expect(result.ok).toBe(true);
  });

  it("detects mismatch between custom sourceField and actual columns", async () => {
    const config = makeConfig({
      tasks: { title: "CustomTitleField", status: "TaskStatus", priority: "Priority" },
    });

    const client = makeColumnClient({
      // "Title" exists but config maps to "CustomTitleField" which doesn't
      tasks: [column("Title"), column("TaskStatus"), column("Priority")],
      projects: [column("Title"), column("ProjectStatus")],
    });

    const result = await validateWorkspaceConfigAgainstGraph(config, client);

    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].semanticField).toBe("title");
    expect(result.issues[0].sourceField).toBe("CustomTitleField");
  });
});
