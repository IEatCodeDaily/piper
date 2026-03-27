import { useQuery } from "@tanstack/react-query";
import { mockGraphClient } from "@/lib/graph/graph-client";
import { validateWorkspaceConfigAgainstGraph } from "@/lib/graph/validate-workspace-config";
import { useWorkspaceCatalog } from "@/features/workspaces/runtime/workspace-catalog";

export function useWorkspaceValidation(workspaceId: string | null) {
  const { workspaces } = useWorkspaceCatalog();
  const workspaceConfig = workspaces.find((workspace) => workspace.workspace.id === workspaceId) ?? null;

  return useQuery({
    queryKey: ["workspace-validation", workspaceId],
    enabled: workspaceConfig !== null,
    queryFn: async () => validateWorkspaceConfigAgainstGraph(workspaceConfig!, mockGraphClient),
  });
}
