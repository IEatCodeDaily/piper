import { useQuery } from "@tanstack/react-query";
import type { WorkspaceTaskQuery } from "@/lib/repository/piper-repository";
import { queryKeys } from "@/lib/query/query-keys";
import { getPiperRepository } from "@/lib/repository/piper-repository";

export function useWorkspaceTasks(query: WorkspaceTaskQuery | null) {
  return useQuery({
    queryKey: query ? queryKeys.tasks.workspace(query) : [...queryKeys.tasks.all, "idle"],
    queryFn: async () => {
      if (!query) {
        return [];
      }

      return getPiperRepository().listWorkspaceTasks(query);
    },
    enabled: query !== null,
  });
}
