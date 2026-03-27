import { type ReactNode, useEffect, useMemo } from "react";
import { useAuthStore } from "@/features/auth/state/use-auth-store";
import { useWorkspaceCatalog } from "@/features/workspaces/runtime/workspace-catalog";
import { queryClient } from "@/lib/query/query-client";
import { createRuntimeRepository } from "@/lib/repository/create-runtime-repository";
import { setPiperRepository } from "@/lib/repository/piper-repository";
import { useRuntimeSettings } from "@/lib/runtime/runtime-settings";

type PiperRuntimeBoundaryProps = {
  children: ReactNode;
};

export function PiperRuntimeBoundary({ children }: PiperRuntimeBoundaryProps) {
  const { repositoryMode } = useRuntimeSettings();
  const { workspaces } = useWorkspaceCatalog();
  const { initialize, getAccessToken, status } = useAuthStore();

  const workspaceSignature = useMemo(
    () => JSON.stringify(workspaces.map((workspace) => workspace.workspace.id).sort()),
    [workspaces],
  );

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const repository = createRuntimeRepository({
      mode: repositoryMode,
      workspaceConfigs: workspaces,
      accessTokenProvider: repositoryMode === "graph-live" && status === "signed-in" ? getAccessToken : undefined,
    });

    setPiperRepository(repository);
    void queryClient.invalidateQueries();
  }, [getAccessToken, repositoryMode, status, workspaceSignature, workspaces]);

  return children;
}
