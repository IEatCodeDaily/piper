import type { CommentRef } from "@/features/comments/types";
import type { PersonRef } from "@/features/people/types";

export interface TaskAttachment {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  url: string;
}

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface WorkspaceTask {
  id: string;
  externalId: string;
  workspaceId: string;
  title: string;
  status: "backlog" | "planned" | "in-progress" | "blocked" | "in-review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  description: string;
  assignee?: PersonRef;
  reporter?: PersonRef;
  watchers: PersonRef[];
  projectId?: string;
  projectCode?: string;
  parentTaskId?: string;
  path: string[];
  labels: string[];
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  estimatePoints?: number;
  remainingPoints?: number;
  sortOrder: number;
  checklist: TaskChecklistItem[];
  attachments: TaskAttachment[];
  commentIds: string[];
  comments?: CommentRef[];
  createdAt: string;
  updatedAt: string;
  createdBy: PersonRef;
  modifiedBy: PersonRef;
}
