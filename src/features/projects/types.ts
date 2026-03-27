import type { PersonRef } from "@/features/people/types";

export interface ProjectHealth {
  status: "on-track" | "at-risk" | "off-track" | "done";
  summary: string;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
}

export interface WorkspaceProject {
  id: string;
  externalId: string;
  workspaceId: string;
  projectCode: string;
  title: string;
  description: string;
  status: "planned" | "active" | "blocked" | "complete" | "on-hold";
  health: ProjectHealth;
  owner: PersonRef;
  collaborators: PersonRef[];
  startDate?: string;
  targetDate?: string;
  completedAt?: string;
  priority: "low" | "medium" | "high" | "urgent";
  progressPercent: number;
  labels: string[];
  parentProjectId?: string;
  path: string[];
  milestoneIds: string[];
  milestones: ProjectMilestone[];
  taskIds: string[];
  taskCount: number;
  openTaskCount: number;
  createdAt: string;
  updatedAt: string;
}
