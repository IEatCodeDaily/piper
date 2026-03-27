import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-keys";
import { getPiperRepository } from "@/lib/repository/piper-repository";

export function useWorkspaces() {
  return useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: async () => getPiperRepository().listWorkspaces(),
  });
}
