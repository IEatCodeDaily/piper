import { useEffect } from "react";
import { queryKeys } from "@/lib/query/query-keys";
import { useWorkspaceStore } from "@/features/workspaces/state/use-workspace-store";
import { useWorkspaces } from "@/features/workspaces/hooks/use-workspaces";

export function useActiveWorkspace() {
  const { data: workspaces = [], ...query } = useWorkspaces();
  const { activeWorkspaceId, setActiveWorkspaceId } = useWorkspaceStore();

  useEffect(() => {
    if (workspaces.length > 0 && activeWorkspaceId === null) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [activeWorkspaceId, setActiveWorkspaceId, workspaces]);

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? workspaces[0];

  return {
    ...query,
    data: activeWorkspace,
    queryKey: queryKeys.workspaces.active(),
  };
}
