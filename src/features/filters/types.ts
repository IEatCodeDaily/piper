import type { WorkspaceTask } from "@/features/tasks/types";

export type TaskStatus = WorkspaceTask["status"];

export interface TaskFilters {
  status: TaskStatus[];
  assigneeId: string[];
  projectId: string[];
}

export interface FilterChipData {
  id: string;
  label: string;
}

export const STATUS_OPTIONS: FilterChipData[] = [
  { id: "backlog", label: "Backlog" },
  { id: "planned", label: "Planned" },
  { id: "in-progress", label: "In Progress" },
  { id: "blocked", label: "Blocked" },
  { id: "in-review", label: "In Review" },
  { id: "done", label: "Done" },
];

export const DEFAULT_FILTERS: TaskFilters = {
  status: [],
  assigneeId: [],
  projectId: [],
};
