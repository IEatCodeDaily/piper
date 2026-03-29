export interface WorkspaceSourceRef {
  siteId: string;
  webId?: string;
  listId: string;
  label: string;
  entityType: "task" | "project" | "comment";
}

export interface WorkspaceViewPreset {
  id: string;
  name: string;
  kind: "list" | "board" | "timeline" | "detail" | "my-tasks";
  description?: string;
  default: boolean;
}

export interface WorkspaceSummary {
  taskCount: number;
  projectCount: number;
  openTaskCount: number;
  overdueTaskCount: number;
}

export interface PiperWorkspace {
  id: string;
  slug: string;
  name: string;
  description: string;
  tenantName: string;
  mode: "mock" | "graph" | "jira" | "github";
  sourceRefs: WorkspaceSourceRef[];
  presets: WorkspaceViewPreset[];
  summary: WorkspaceSummary;
  createdAt: string;
  updatedAt: string;
}
