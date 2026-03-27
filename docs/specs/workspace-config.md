# Piper — Workspace Config Contract

> Runtime JSON contract for Piper workspace definitions.

## Purpose

The workspace config is the contract between Piper's UI/runtime and a team's Microsoft Lists schema. It keeps SharePoint Lists as the source of truth while letting Piper map source columns into project/task semantics without code changes.

This phase 1 contract covers:
- stable workspace, tenant, site, and list identifiers
- human-readable labels for admins and workspace switching
- semantic field mapping for separate project and task lists
- renderer mapping per semantic field
- saved view presets
- optional project hierarchy, task parent, and dependency mappings

## Document Shape

```json
{
  "version": 1,
  "workspace": {
    "id": "core-ops",
    "label": "Core Operations",
    "tenant": {
      "id": "tenant-guid",
      "label": "Northwind Engineering"
    }
  },
  "lists": {
    "projects": {
      "site": { "id": "site-id", "label": "Operations PMO" },
      "list": { "id": "projects-list-guid", "label": "Projects" },
      "fields": {},
      "renderers": {},
      "relations": {}
    },
    "tasks": {
      "site": { "id": "site-id", "label": "Operations PMO" },
      "list": { "id": "tasks-list-guid", "label": "Tasks" },
      "fields": {},
      "renderers": {},
      "relations": {}
    }
  },
  "views": []
}
```

## Top-Level Fields

| Field | Type | Required | Notes |
|------|------|----------|------|
| `version` | `1` | yes | Contract version for runtime validation and future migrations. |
| `workspace.id` | string | yes | Stable Piper workspace identifier. |
| `workspace.label` | string | yes | Human-readable workspace name. |
| `workspace.description` | string | no | Admin-facing summary. |
| `workspace.tenant.id` | string | yes | Stable Microsoft 365 tenant identifier. |
| `workspace.tenant.label` | string | yes | Human-readable tenant label. |
| `workspace.tenant.domain` | string | no | Tenant/domain hint for admins. |
| `lists.projects` | object | yes | Project list contract. |
| `lists.tasks` | object | yes | Task list contract. |
| `views` | array | yes | Saved list/board/timeline presets. |

## List Contract

Both `lists.projects` and `lists.tasks` use the same shape.

| Field | Type | Required | Notes |
|------|------|----------|------|
| `site.id` | string | yes | Stable SharePoint site identifier. |
| `site.label` | string | yes | Human-readable site label. |
| `site.webUrl` | string (url) | no | Useful for diagnostics/admin tooling. |
| `list.id` | string | yes | Stable list identifier. |
| `list.label` | string | yes | Human-readable list label. |
| `fields` | record | yes | Semantic field mapping keyed by Piper semantic field name. |
| `renderers` | record | yes | Renderer mapping keyed by the same semantic field names. |
| `relations` | object | no | Optional relationship toggles and field references. |

## Semantic Field Mapping

A semantic field mapping entry binds a Piper-native field name to the source column used in SharePoint/Microsoft Lists.

| Field | Type | Required | Notes |
|------|------|----------|------|
| `sourceField` | string | yes | Column internal name or agreed source key. |
| `dataType` | enum | yes | Supported values: `string`, `text`, `number`, `boolean`, `date`, `datetime`, `person`, `person-multi`, `choice`, `choice-multi`, `lookup`, `lookup-multi`, `labels`, `markdown`, `url`. |
| `required` | boolean | no | Defaults to `false`. Signals Piper-required semantics. |
| `editable` | boolean | no | Defaults to `true`. Use `false` for source-managed fields like item IDs. |
| `description` | string | no | Optional admin hint. |

Recommended project semantics:
- `id`
- `projectCode`
- `title`
- `status`
- `owner`
- `startDate`
- `dueDate`
- `description`
- `parentProjectRef` when hierarchy exists

Recommended task semantics:
- `id`
- `title`
- `status`
- `priority`
- `assignee`
- `description`
- `projectRef`
- `startDate`
- `dueDate`
- `labels`
- `parentTaskRef` when task hierarchy exists
- `dependsOnRefs` when dependency mapping exists

## Renderer Mapping

Renderers are keyed by semantic field name and tell Piper how to present the field in tables, boards, detail panes, and filters.

| Field | Type | Required | Notes |
|------|------|----------|------|
| `kind` | enum | yes | Supported values: `text`, `markdown`, `date`, `datetime`, `person`, `person-list`, `choice-pill`, `labels`, `lookup`, `link`. |
| `label` | string | no | Optional display override. |
| `options` | record | no | Free-form renderer settings such as color palettes. |

Validation rules:
- every renderer key must match a declared semantic field
- renderer options are intentionally open-ended in phase 1 so UI components can evolve without breaking the config contract

## Relationship Mapping

List-level relations enable higher-order behaviors without forcing every workspace to support them.

| Relation | Typical scope | Notes |
|----------|---------------|------|
| `hierarchy` | `projects` | Enables parent-child project rollups via a lookup field such as `parentProjectRef`. |
| `project` | `tasks` | Connects tasks to their owning project via a field such as `projectRef`. |
| `parent` | `tasks` | Optional task parent mapping. Can be present in source schema but disabled by default. |
| `dependencies` | `tasks` | Optional dependency mapping for timeline/planning features. |

Relation shape:

| Field | Type | Required | Notes |
|------|------|----------|------|
| `enabled` | boolean | yes | Feature toggle for the relation. |
| `field` | string | no | Semantic field key used for the relation. When set, it must match a declared field. |
| `description` | string | no | Admin note. |

## Saved View Presets

Views are workspace-owned presets that decouple UI layout from raw source columns.

| Field | Type | Required | Notes |
|------|------|----------|------|
| `id` | string | yes | Stable preset identifier. |
| `label` | string | yes | Human-readable preset name. |
| `description` | string | no | Optional user/admin note. |
| `scope` | enum | yes | `projects` or `tasks`. |
| `kind` | enum | yes | `list`, `board`, or `timeline`. |
| `isDefault` | boolean | no | At most one default preset per scope. |
| `visibleFields` | string[] | no | Semantic fields shown by default. |
| `groupBy` | string | no | Semantic field used for grouping. |
| `swimlaneBy` | string | no | Reserved for board-style layouts. |
| `dateField` | string | no | Main date field for schedule/timeline views. |
| `filters` | array | no | Saved filter rules referencing semantic fields. |
| `sort` | array | no | Saved sort rules referencing semantic fields. |

Validation rules:
- view field references must point at fields declared for the selected scope
- only one default preset is allowed for `projects`
- only one default preset is allowed for `tasks`

## Runtime Validation

Runtime validation lives in `src/features/workspaces/schema.ts` and uses Zod.

Primary loader helpers live in `src/features/workspaces/loaders.ts`:
- `parseWorkspaceConfig(input)` validates unknown input
- `parseWorkspaceConfigJson(raw)` parses and validates JSON text
- `loadWorkspaceConfigFromUrl(url)` fetches and validates a JSON document

## Sample Fixture

A realistic sample workspace is included at:
- `src/features/workspaces/fixtures/core-ops.workspace.json`

This sample models the known Piper discussion:
- one tenant
- separate project and task lists
- project hierarchy enabled
- task parent mapping present but disabled by default
- dependency mapping present but disabled by default
- stable site/list IDs plus human-readable labels
