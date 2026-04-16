/**
 * createRuntimeRepository — factory that wires the correct PiperRepository
 * implementation for a given runtime mode.
 *
 * graph-live mode: uses FetchGraphClient backed by MicrosoftAuthProvider
 * graph-mock mode: uses PlaceholderGraphRepository with MockGraphClient
 * mock mode:       uses the static in-memory mock repository
 *
 * The `accessTokenProvider` argument remains supported for backwards
 * compatibility (e.g. tests, legacy callers).  When omitted in graph-live
 * mode the MicrosoftAuthProvider is used automatically.
 *
 * NEV-13 — M1: Microsoft Graph API OAuth2 auth flow
 */

import type { WorkspaceConfig } from "@/features/workspaces/types";
import { FetchGraphClient, mockGraphClient } from "@/lib/graph/graph-client";
import { PlaceholderGraphRepository } from "@/lib/graph/placeholder-graph-repository";
import { JiraPiperRepository } from "@/lib/jira/jira-repository";
import { GitHubPiperRepository } from "@/lib/github/github-repository";
import { mockPiperRepository } from "@/lib/repository/mock-piper-repository";
import type { PiperRepository } from "@/lib/repository/piper-repository";
import type { RepositoryMode } from "@/lib/runtime/runtime-settings";
import { MicrosoftAuthProvider } from "@/lib/store/microsoft-auth-provider";

/**
 * Singleton MicrosoftAuthProvider instance.
 *
 * Shared across repository re-creations so that the cached MSAL token
 * survives mode switches and workspace config changes.
 */
let _msAuthProvider: MicrosoftAuthProvider | null = null;

function getMicrosoftAuthProvider(): MicrosoftAuthProvider {
  if (!_msAuthProvider) {
    _msAuthProvider = new MicrosoftAuthProvider();
    // Initialize the provider asynchronously — it will pick up any cached
    // MSAL account from a previous session.
    void _msAuthProvider.initialize({});
  }
  return _msAuthProvider;
}

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
  /** Optional explicit token provider — overrides MicrosoftAuthProvider when supplied. */
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
  if (mode === "graph-mock") {
    return new PlaceholderGraphRepository({
      workspaceConfigs,
      graphClient: mockGraphClient,
    });
  }

  // graph-live: prefer an explicit provider, fall back to MicrosoftAuthProvider
  const tokenProvider =
    accessTokenProvider ?? getMicrosoftAuthProvider().getAccessTokenProvider();

  return new PlaceholderGraphRepository({
    workspaceConfigs,
    graphClient: new FetchGraphClient({
      accessTokenProvider: tokenProvider,
    }),
  });
}

/**
 * Expose the shared MicrosoftAuthProvider for use in components that need
 * direct auth state (e.g. sign-in/sign-out buttons, token refresh on 401).
 */
export { getMicrosoftAuthProvider };
