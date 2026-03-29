import type { WorkspaceTask } from "@/features/tasks/types";

export interface CreateTaskInput {
  workspaceId: string;
  projectId?: string;
  title: string;
  status?: WorkspaceTask["status"];
  priority?: WorkspaceTask["priority"];
  assigneeId?: string;
  dueDate?: string;
  startDate?: string;
  labels?: string[];
}
