import type { WorkspaceConfig } from "@/features/workspaces/types";
import { FetchGraphClient, mockGraphClient } from "@/lib/graph/graph-client";
import { PlaceholderGraphRepository } from "@/lib/graph/placeholder-graph-repository";
import { mockPiperRepository } from "@/lib/repository/mock-piper-repository";
import type { PiperRepository } from "@/lib/repository/piper-repository";
import type { RepositoryMode } from "@/lib/runtime/runtime-settings";

export function createRuntimeRepository(args: {
  mode: RepositoryMode;
  workspaceConfigs: WorkspaceConfig[];
  accessTokenProvider?: () => Promise<string>;
}): PiperRepository {
  const { mode, workspaceConfigs, accessTokenProvider } = args;

  if (mode === "mock") {
    return mockPiperRepository;
  }

  if (mode === "graph-mock" || !accessTokenProvider) {
    return new PlaceholderGraphRepository({
      workspaceConfigs,
      graphClient: mockGraphClient,
    });
  }

  return new PlaceholderGraphRepository({
    workspaceConfigs,
    graphClient: new FetchGraphClient({
      accessTokenProvider,
    }),
  });
}
