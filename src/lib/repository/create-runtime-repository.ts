import type { WorkspaceConfig } from "@/features/workspaces/types";
import { FetchGraphClient, mockGraphClient } from "@/lib/graph/graph-client";
import { PlaceholderGraphRepository } from "@/lib/graph/placeholder-graph-repository";
import { JiraPiperRepository } from "@/lib/jira/jira-repository";
import { GitHubPiperRepository } from "@/lib/github/github-repository";
import { mockPiperRepository } from "@/lib/repository/mock-piper-repository";
import type { PiperRepository } from "@/lib/repository/piper-repository";
import type { RepositoryMode } from "@/lib/runtime/runtime-settings";

/**
 * Creates a mock Jira client that returns stub data.
 * Used when mode is "jira-mock" for development/testing without a real Jira instance.
 */
function createMockJiraRepository(workspaceConfigs: WorkspaceConfig[]): JiraPiperRepository {
  return new JiraPiperRepository({
    workspaceConfigs,
    accessTokenProvider: async () => "mock-token",
  })
}

/**
 * Creates a mock GitHub client that returns stub data.
 * Used when mode is "github-mock" for development/testing without a real GitHub instance.
 */
function createMockGitHubRepository(workspaceConfigs: WorkspaceConfig[]): GitHubPiperRepository {
  return new GitHubPiperRepository({
    workspaceConfigs,
    accessTokenProvider: async () => "mock-token",
  })
}

export function createRuntimeRepository(args: {
  mode: RepositoryMode;
  workspaceConfigs: WorkspaceConfig[];
  accessTokenProvider?: () => Promise<string>;
}): PiperRepository {
  const { mode, workspaceConfigs, accessTokenProvider } = args;

  if (mode === "mock") {
    return mockPiperRepository;
  }

  if (mode === "jira-mock") {
    return createMockJiraRepository(workspaceConfigs);
  }

  if (mode === "jira-live") {
    if (!accessTokenProvider) {
      return createMockJiraRepository(workspaceConfigs);
    }

    return new JiraPiperRepository({
      workspaceConfigs,
      accessTokenProvider,
    });
  }

  if (mode === "github-mock") {
    return createMockGitHubRepository(workspaceConfigs);
  }

  if (mode === "github-live") {
    if (!accessTokenProvider) {
      return createMockGitHubRepository(workspaceConfigs);
    }

    return new GitHubPiperRepository({
      workspaceConfigs,
      accessTokenProvider,
    });
  }

  // Graph modes (graph-mock, graph-live)
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
