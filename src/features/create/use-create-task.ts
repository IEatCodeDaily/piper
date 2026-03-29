import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-keys";
import { getPiperRepository, type CreateTaskInput as RepoCreateTaskInput } from "@/lib/repository/piper-repository";
import type { CreateTaskInput } from "./types";
import type { WorkspaceTask } from "@/features/tasks/types";

export function useCreateTask() {
  return useMutation({
    mutationFn: async (input: CreateTaskInput): Promise<WorkspaceTask> => {
      const repoInput: RepoCreateTaskInput = {
        workspaceId: input.workspaceId,
        title: input.title,
        projectId: input.projectId,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId,
        dueDate: input.dueDate,
        startDate: input.startDate,
        labels: input.labels,
      };
      return getPiperRepository().createTask(repoInput);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
}
