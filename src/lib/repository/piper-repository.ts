import type { CommentRef } from "@/features/comments/types";
import type { PersonRef } from "@/features/people/types";
import type { WorkspaceProject } from "@/features/projects/types";
import type { WorkspaceTask } from "@/features/tasks/types";
import type { PiperWorkspace } from "@/lib/domain/workspace";

export interface WorkspaceTaskQuery {
  workspaceId: string;
  projectId?: string;
  assigneeId?: string;
  statuses?: WorkspaceTask["status"][];
  includeCompleted?: boolean;
}

export interface WorkspaceProjectQuery {
  workspaceId: string;
  parentProjectId?: string;
  includeCompleted?: boolean;
}

export interface TaskUpdateInput {
  workspaceId: string;
  taskId: string;
  patch: Partial<Pick<WorkspaceTask, "status" | "priority" | "title" | "description" | "dueDate" | "startDate" | "labels">>;
}

export interface CreateCommentInput {
  workspaceId: string;
  entityType: CommentRef["entityType"];
  entityId: string;
  body: string;
  bodyFormat?: CommentRef["bodyFormat"];
}

export interface PiperRepository {
  listWorkspaces(): Promise<PiperWorkspace[]>;
  getActiveWorkspace(): Promise<PiperWorkspace>;
  listWorkspacePeople(workspaceId: string): Promise<PersonRef[]>;
  listWorkspaceProjects(query: WorkspaceProjectQuery): Promise<WorkspaceProject[]>;
  listWorkspaceTasks(query: WorkspaceTaskQuery): Promise<WorkspaceTask[]>;
  listWorkspaceComments(workspaceId: string): Promise<CommentRef[]>;
  updateTask(input: TaskUpdateInput): Promise<WorkspaceTask>;
  createComment(input: CreateCommentInput): Promise<CommentRef>;
}

let defaultPiperRepository: PiperRepository | null = null;

export function setPiperRepository(repository: PiperRepository) {
  defaultPiperRepository = repository;
}

export function getPiperRepository() {
  if (!defaultPiperRepository) {
    throw new Error("Piper repository has not been configured.");
  }

  return defaultPiperRepository;
}
