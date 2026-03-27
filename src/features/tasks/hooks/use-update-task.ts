import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-keys";
import { getPiperRepository, type TaskUpdateInput } from "@/lib/repository/piper-repository";

export function useUpdateTask() {
  return useMutation({
    mutationFn: async (input: TaskUpdateInput) => getPiperRepository().updateTask(input),
    onSuccess: (_task, input) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments.workspace(input.workspaceId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all });
    },
  });
}
