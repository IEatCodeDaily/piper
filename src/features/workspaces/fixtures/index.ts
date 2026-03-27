import coreOpsWorkspaceConfigJson from './core-ops.workspace.json'
import { parseWorkspaceConfig } from '@/features/workspaces/loaders'

export const coreOpsWorkspaceFixtureUrl = new URL('./core-ops.workspace.json', import.meta.url)

export const coreOpsWorkspaceFixture = parseWorkspaceConfig(coreOpsWorkspaceConfigJson)

export const workspaceFixtureUrls = {
  coreOps: coreOpsWorkspaceFixtureUrl,
} as const

export const workspaceFixtures = {
  coreOps: coreOpsWorkspaceFixture,
} as const
