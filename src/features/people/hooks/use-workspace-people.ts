import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { getPiperRepository } from "@/lib/repository/piper-repository";

export function useWorkspacePeople(workspaceId: string | null) {
  return useQuery({
    queryKey: workspaceId ? queryKeys.workspaces.people(workspaceId) : [...queryKeys.workspaces.all, "people", "idle"],
    queryFn: async () => {
      if (!workspaceId) {
        return [];
      }

      return getPiperRepository().listWorkspacePeople(workspaceId);
    },
    enabled: workspaceId !== null,
  });
}
