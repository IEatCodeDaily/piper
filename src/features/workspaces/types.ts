import type { z } from 'zod'

import type { workspaceConfigSchema } from './schema'

export const workspaceEntityScopes = ['projects', 'tasks'] as const
export type WorkspaceEntityScope = (typeof workspaceEntityScopes)[number]

export const workspaceViewKinds = ['list', 'board', 'timeline'] as const
export type WorkspaceViewKind = (typeof workspaceViewKinds)[number]

export const workspaceFieldDataTypes = [
  'string',
  'text',
  'number',
  'boolean',
  'date',
  'datetime',
  'person',
  'person-multi',
  'choice',
  'choice-multi',
  'lookup',
  'lookup-multi',
  'labels',
  'markdown',
  'url',
] as const
export type WorkspaceFieldDataType = (typeof workspaceFieldDataTypes)[number]

export const workspaceRendererKinds = [
  'text',
  'markdown',
  'date',
  'datetime',
  'person',
  'person-list',
  'choice-pill',
  'labels',
  'lookup',
  'link',
] as const
export type WorkspaceRendererKind = (typeof workspaceRendererKinds)[number]

export const workspaceFilterOperators = [
  'eq',
  'neq',
  'contains',
  'notContains',
  'in',
  'notIn',
  'isEmpty',
  'isNotEmpty',
  'gte',
  'lte',
] as const
export type WorkspaceFilterOperator = (typeof workspaceFilterOperators)[number]

export const workspaceSortDirections = ['asc', 'desc'] as const
export type WorkspaceSortDirection = (typeof workspaceSortDirections)[number]

export type WorkspaceConfig = z.infer<typeof workspaceConfigSchema>
export type WorkspaceListConfig = WorkspaceConfig['lists'][WorkspaceEntityScope]
export type WorkspaceViewPreset = WorkspaceConfig['views'][number]
export type WorkspaceFieldMapping =
  WorkspaceListConfig['fields'][keyof WorkspaceListConfig['fields']]
export type WorkspaceRendererMapping =
  WorkspaceListConfig['renderers'][keyof WorkspaceListConfig['renderers']]
