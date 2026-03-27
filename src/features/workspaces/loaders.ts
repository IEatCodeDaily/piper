import type { ZodIssue } from 'zod'

import { workspaceConfigSchema } from './schema'
import type { WorkspaceConfig } from './types'

export class WorkspaceConfigError extends Error {
  readonly issues: ZodIssue[]

  constructor(message: string, issues: ZodIssue[]) {
    super(message)
    this.name = 'WorkspaceConfigError'
    this.issues = issues
  }
}

export function parseWorkspaceConfig(input: unknown): WorkspaceConfig {
  const result = workspaceConfigSchema.safeParse(input)

  if (!result.success) {
    throw new WorkspaceConfigError('Workspace config validation failed.', result.error.issues)
  }

  return result.data
}

export function parseWorkspaceConfigJson(raw: string): WorkspaceConfig {
  try {
    return parseWorkspaceConfig(JSON.parse(raw))
  } catch (error) {
    if (error instanceof WorkspaceConfigError) {
      throw error
    }

    if (error instanceof SyntaxError) {
      throw new WorkspaceConfigError('Workspace config is not valid JSON.', [])
    }

    throw error
  }
}

export async function loadWorkspaceConfigFromUrl(url: string): Promise<WorkspaceConfig> {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`Failed to load workspace config from ${url}: ${response.status} ${response.statusText}`)
  }

  return parseWorkspaceConfig(await response.json())
}
