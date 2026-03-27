export type WorkspaceViewId = "workspace" | "list" | "kanban" | "timeline" | "my-tasks";

export interface WorkspaceViewOption {
  id: WorkspaceViewId;
  label: string;
  description: string;
}
