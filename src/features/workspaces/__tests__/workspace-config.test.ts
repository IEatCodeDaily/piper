import { describe, it, expect } from 'vitest'
import { workspaceConfigSchema } from '../schema'

/** Helper to build a minimal valid config. Fields are required to be non-empty records. */
function makeValidConfig() {
  return {
    version: 1,
    workspace: {
      id: 'ws-1',
      label: 'My Workspace',
      tenant: {
        id: 'tenant-1',
        label: 'My Tenant',
      },
    },
    lists: {
      projects: {
        site: { id: 'site-p', label: 'Project Site' },
        list: { id: 'list-p', label: 'Project List' },
        fields: {
          title: {
            sourceField: 'Title',
            dataType: 'string',
          },
          status: {
            sourceField: 'Status',
            dataType: 'choice',
          },
        },
      },
      tasks: {
        site: { id: 'site-t', label: 'Task Site' },
        list: { id: 'list-t', label: 'Task List' },
        fields: {
          title: {
            sourceField: 'Title',
            dataType: 'string',
          },
          priority: {
            sourceField: 'Priority',
            dataType: 'choice',
          },
        },
      },
    },
  }
}

describe('workspaceConfigSchema', () => {
  it('parses a valid config successfully', () => {
    const config = makeValidConfig()
    const result = workspaceConfigSchema.parse(config)

    expect(result.version).toBe(1)
    expect(result.workspace.id).toBe('ws-1')
    expect(result.workspace.label).toBe('My Workspace')
    expect(result.workspace.tenant.id).toBe('tenant-1')
    expect(result.lists.projects.fields.title.sourceField).toBe('Title')
    expect(result.lists.tasks.fields.title.sourceField).toBe('Title')
    // Defaults applied
    expect(result.views).toEqual([])
    expect(result.lists.projects.renderers).toEqual({})
    expect(result.lists.projects.relations).toEqual({})
    expect(result.lists.projects.fields.title.required).toBe(false)
    expect(result.lists.projects.fields.title.editable).toBe(true)
  })

  it('rejects missing required fields', () => {
    // Missing workspace.label
    expect(() =>
      workspaceConfigSchema.parse({
        ...makeValidConfig(),
        workspace: {
          id: 'ws-1',
          tenant: { id: 'tenant-1', label: 'T' },
        },
      }),
    ).toThrow()

    // Missing workspace.tenant
    expect(() =>
      workspaceConfigSchema.parse({
        ...makeValidConfig(),
        workspace: {
          id: 'ws-1',
          label: 'My Workspace',
        },
      }),
    ).toThrow()

    // Missing lists.projects
    expect(() =>
      workspaceConfigSchema.parse({
        ...makeValidConfig(),
        lists: {
          tasks: makeValidConfig().lists.tasks,
        },
      }),
    ).toThrow()

    // Missing version
    expect(() => {
      const { version: _version, ...noVersion } = makeValidConfig();
      void _version;
      workspaceConfigSchema.parse(noVersion)
    }).toThrow()
  })

  it('rejects an invalid version', () => {
    expect(() =>
      workspaceConfigSchema.parse({
        ...makeValidConfig(),
        version: 2,
      }),
    ).toThrow()

    expect(() =>
      workspaceConfigSchema.parse({
        ...makeValidConfig(),
        version: '1',
      }),
    ).toThrow()
  })

  it('rejects a renderer referencing an undeclared field', () => {
    const config = makeValidConfig()
    const projectsList = {
      ...config.lists.projects,
      renderers: {
        nonexistentField: {
          kind: 'text',
        },
      },
    }

    expect(() =>
      workspaceConfigSchema.parse({
        ...config,
        lists: {
          ...config.lists,
          projects: projectsList,
        },
      }),
    ).toThrow()
  })

  it('allows a renderer referencing a declared field', () => {
    const config = makeValidConfig()
    const result = workspaceConfigSchema.parse({
      ...config,
      lists: {
        ...config.lists,
        projects: {
          ...config.lists.projects,
          renderers: {
            title: {
              kind: 'text',
            },
          },
        },
      },
    })

    expect(result.lists.projects.renderers.title.kind).toBe('text')
  })

  it('accepts empty fields records (schema does not enforce minimum fields)', () => {
    const config = makeValidConfig()
    const result = workspaceConfigSchema.parse({
      ...config,
      lists: {
        ...config.lists,
        projects: {
          ...config.lists.projects,
          fields: {},
        },
      },
    })

    expect(result.lists.projects.fields).toEqual({})
  })

  it('parses a valid config with optional fields omitted', () => {
    const config = makeValidConfig()
    const result = workspaceConfigSchema.parse(config)

    expect(result.workspace.description).toBeUndefined()
    expect(result.workspace.tenant.domain).toBeUndefined()
    expect(result.views).toEqual([])
    expect(result.lists.projects.site.webUrl).toBeUndefined()
    expect(result.lists.projects.list.webUrl).toBeUndefined()
    expect(result.lists.projects.renderers).toEqual({})
    expect(result.lists.tasks.renderers).toEqual({})
    expect(result.lists.projects.relations).toEqual({})
    expect(result.lists.tasks.relations).toEqual({})
  })

  it('rejects empty strings for id and label fields', () => {
    const config = makeValidConfig()
    config.workspace.id = ''

    expect(() => workspaceConfigSchema.parse(config)).toThrow()

    config.workspace.id = 'ws-1'
    config.workspace.label = '   '

    expect(() => workspaceConfigSchema.parse(config)).toThrow()
  })
})
