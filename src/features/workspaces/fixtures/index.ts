export const coreOpsWorkspaceFixtureUrl = new URL('./core-ops.workspace.json', import.meta.url)

export const workspaceFixtureUrls = {
  coreOps: coreOpsWorkspaceFixtureUrl,
} as const
