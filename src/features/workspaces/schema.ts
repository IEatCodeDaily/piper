import { z } from 'zod'

import {
  workspaceEntityScopes,
  workspaceFieldDataTypes,
  workspaceFilterOperators,
  workspaceRendererKinds,
  workspaceSortDirections,
  workspaceViewKinds,
} from './types'

const nonEmptyStringSchema = z.string().trim().min(1)
const semanticFieldKeySchema = z.string().trim().min(1)

const workspaceVersionSchema = z.literal(1)

const labeledIdentifierSchema = z.object({
  id: nonEmptyStringSchema,
  label: nonEmptyStringSchema,
  webUrl: nonEmptyStringSchema.url().optional(),
})

const workspaceFieldMappingSchema = z.object({
  sourceField: nonEmptyStringSchema,
  dataType: z.enum(workspaceFieldDataTypes),
  required: z.boolean().default(false),
  editable: z.boolean().default(true),
  description: z.string().trim().optional(),
})

const workspaceRendererMappingSchema = z.object({
  kind: z.enum(workspaceRendererKinds),
  label: z.string().trim().optional(),
  options: z.record(z.string(), z.unknown()).default({}),
})

const workspaceRelationSchema = z.object({
  enabled: z.boolean(),
  field: semanticFieldKeySchema.optional(),
  description: z.string().trim().optional(),
})

export const workspaceListConfigSchema = z.object({
  site: labeledIdentifierSchema,
  list: labeledIdentifierSchema,
  fields: z.record(semanticFieldKeySchema, workspaceFieldMappingSchema),
  renderers: z.record(semanticFieldKeySchema, workspaceRendererMappingSchema).default({}),
  relations: z
    .object({
      hierarchy: workspaceRelationSchema.optional(),
      project: workspaceRelationSchema.optional(),
      parent: workspaceRelationSchema.optional(),
      dependencies: workspaceRelationSchema.optional(),
    })
    .default({}),
})

const workspaceFilterRuleSchema = z.object({
  field: semanticFieldKeySchema,
  operator: z.enum(workspaceFilterOperators),
  value: z.unknown().optional(),
})

const workspaceSortRuleSchema = z.object({
  field: semanticFieldKeySchema,
  direction: z.enum(workspaceSortDirections),
})

export const workspaceViewPresetSchema = z.object({
  id: nonEmptyStringSchema,
  label: nonEmptyStringSchema,
  description: z.string().trim().optional(),
  scope: z.enum(workspaceEntityScopes),
  kind: z.enum(workspaceViewKinds),
  isDefault: z.boolean().default(false),
  visibleFields: z.array(semanticFieldKeySchema).default([]),
  groupBy: semanticFieldKeySchema.optional(),
  swimlaneBy: semanticFieldKeySchema.optional(),
  dateField: semanticFieldKeySchema.optional(),
  filters: z.array(workspaceFilterRuleSchema).default([]),
  sort: z.array(workspaceSortRuleSchema).default([]),
})

export const workspaceConfigSchema = z.object({
  version: workspaceVersionSchema,
  workspace: z.object({
    id: nonEmptyStringSchema,
    label: nonEmptyStringSchema,
    description: z.string().trim().optional(),
    tenant: z.object({
      id: nonEmptyStringSchema,
      label: nonEmptyStringSchema,
      domain: z.string().trim().optional(),
    }),
  }),
  lists: z.object({
    projects: workspaceListConfigSchema,
    tasks: workspaceListConfigSchema,
  }),
  views: z.array(workspaceViewPresetSchema).default([]),
})
.superRefine((config, ctx) => {
  const scopedLists = {
    projects: config.lists.projects,
    tasks: config.lists.tasks,
  }

  for (const [scope, listConfig] of Object.entries(scopedLists)) {
    const fieldKeys = new Set(Object.keys(listConfig.fields))

    for (const rendererKey of Object.keys(listConfig.renderers)) {
      if (!fieldKeys.has(rendererKey)) {
        ctx.addIssue({
          code: 'custom',
          message: `Renderer mapping '${rendererKey}' in ${scope} must reference a declared semantic field.`,
          path: ['lists', scope, 'renderers', rendererKey],
        })
      }
    }

    for (const [relationKey, relationConfig] of Object.entries(listConfig.relations)) {
      if (!relationConfig?.enabled || !relationConfig.field) {
        continue
      }

      if (!fieldKeys.has(relationConfig.field)) {
        ctx.addIssue({
          code: 'custom',
          message: `Relation '${relationKey}' in ${scope} must reference a declared semantic field.`,
          path: ['lists', scope, 'relations', relationKey, 'field'],
        })
      }
    }
  }

  const defaultViewsByScope = new Map<string, number>()

  for (const [index, view] of config.views.entries()) {
    const fieldKeys = new Set(Object.keys(config.lists[view.scope].fields))

    if (view.isDefault) {
      defaultViewsByScope.set(view.scope, (defaultViewsByScope.get(view.scope) ?? 0) + 1)
    }

    for (const visibleField of view.visibleFields) {
      if (!fieldKeys.has(visibleField)) {
        ctx.addIssue({
          code: 'custom',
          message: `View '${view.id}' references unknown visible field '${visibleField}'.`,
          path: ['views', index, 'visibleFields'],
        })
      }
    }

    for (const key of ['groupBy', 'swimlaneBy', 'dateField'] as const) {
      const value = view[key]
      if (value && !fieldKeys.has(value)) {
        ctx.addIssue({
          code: 'custom',
          message: `View '${view.id}' references unknown ${key} field '${value}'.`,
          path: ['views', index, key],
        })
      }
    }

    for (const [filterIndex, filter] of view.filters.entries()) {
      if (!fieldKeys.has(filter.field)) {
        ctx.addIssue({
          code: 'custom',
          message: `View '${view.id}' references unknown filter field '${filter.field}'.`,
          path: ['views', index, 'filters', filterIndex, 'field'],
        })
      }
    }

    for (const [sortIndex, sort] of view.sort.entries()) {
      if (!fieldKeys.has(sort.field)) {
        ctx.addIssue({
          code: 'custom',
          message: `View '${view.id}' references unknown sort field '${sort.field}'.`,
          path: ['views', index, 'sort', sortIndex, 'field'],
        })
      }
    }
  }

  for (const [scope, count] of defaultViewsByScope.entries()) {
    if (count > 1) {
      ctx.addIssue({
        code: 'custom',
        message: `Scope '${scope}' can only define one default view preset.`,
        path: ['views'],
      })
    }
  }
})

export const workspaceListConfigSchemas = {
  projects: workspaceListConfigSchema,
  tasks: workspaceListConfigSchema,
} as const

export const workspaceFieldSchema = workspaceFieldMappingSchema
export const workspaceRendererSchema = workspaceRendererMappingSchema
