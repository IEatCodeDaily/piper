import type { WorkspaceProjectQuery, WorkspaceTaskQuery } from "@/lib/repository/piper-repository";

export const queryKeys = {
  workspaces: {
    all: ["workspaces"] as const,
    list: () => [...queryKeys.workspaces.all, "list"] as const,
    active: () => [...queryKeys.workspaces.all, "active"] as const,
    people: (workspaceId: string) => [...queryKeys.workspaces.all, workspaceId, "people"] as const,
  },
  projects: {
    all: ["projects"] as const,
    workspace: (query: WorkspaceProjectQuery) => [...queryKeys.projects.all, query] as const,
  },
  tasks: {
    all: ["tasks"] as const,
    workspace: (query: WorkspaceTaskQuery) => [...queryKeys.tasks.all, query] as const,
  },
  comments: {
    all: ["comments"] as const,
    workspace: (workspaceId: string) => [...queryKeys.comments.all, workspaceId] as const,
  },
};
