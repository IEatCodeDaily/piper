import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { getPiperRepository } from "@/lib/repository/piper-repository";

export function useActiveWorkspace() {
  return useQuery({
    queryKey: queryKeys.workspaces.active(),
    queryFn: async () => getPiperRepository().getActiveWorkspace(),
  });
}
