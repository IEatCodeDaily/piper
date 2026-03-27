import { useQuery } from "@tanstack/react-query";
import type { WorkspaceProjectQuery } from "@/lib/repository/piper-repository";
import { queryKeys } from "@/lib/query/query-keys";
import { getPiperRepository } from "@/lib/repository/piper-repository";

export function useWorkspaceProjects(query: WorkspaceProjectQuery | null) {
  return useQuery({
    queryKey: query ? queryKeys.projects.workspace(query) : [...queryKeys.projects.all, "idle"],
    queryFn: async () => {
      if (!query) {
        return [];
      }

      return getPiperRepository().listWorkspaceProjects(query);
    },
    enabled: query !== null,
  });
}
