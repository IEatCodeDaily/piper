# Piper — Architecture

> System design and technical architecture for Piper.

## System Overview

```
┌──────────────────────────────────────────────────────────────┐
│                          Piper                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ Tauri Desktop Shell                                   │  │
│  │ ┌────────────────────────────────────────────────────┐ │  │
│  │ │ React + TypeScript UI                             │ │  │
│  │ │ - shadcn/ui                                        │ │  │
│  │ │ - TanStack Query/Table                             │ │  │
│  │ │ - dnd-kit                                          │ │  │
│  │ │ - Markdown/detail editor                           │ │  │
│  │ └────────────────────────────────────────────────────┘ │  │
│  └───────────────────────┬────────────────────────────────┘  │
│                          │                                   │
│        Workspace Config  │  Microsoft auth + Graph calls     │
│                          │                                   │
│  ┌───────────────────────▼────────────────────────────────┐  │
│  │ Piper Application Core                                │  │
│  │ - Workspace loader                                     │  │
│  │ - Mapping engine                                       │  │
│  │ - Graph adapter                                        │  │
│  │ - Sync/update engine                                   │  │
│  │ - View engine                                          │  │
│  └───────────────────────┬────────────────────────────────┘  │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
           Microsoft 365 / SharePoint / Microsoft Lists
```

## Tech Stack

See [ADR-001: Tech Stack](./adr/001-tech-stack.md) for the decision record.

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri v2 |
| Frontend | React + TypeScript + Vite |
| UI | shadcn/ui + Tailwind CSS |
| Server State | TanStack Query |
| Table/Grid | TanStack Table |
| Drag & Drop | dnd-kit |
| Auth | Microsoft delegated auth (MSAL or equivalent flow) |
| Data Source | Microsoft Graph / SharePoint Lists APIs |
| Validation | Zod |
| Markdown | React markdown/editor stack |
| Local State | AppData JSON/SQLite/cache as needed |

## Architectural Principles

### 1. SharePoint Lists Remain the Source of Truth
Piper does not introduce a separate application database for tasks/projects. It reads and writes to SharePoint Lists directly.

### 2. Config-Driven Workspace Model
Every workspace is defined by configuration rather than code. Workspace config includes:
- source list identities
- semantic field mappings
- renderer mappings
- view presets
- optional hierarchy/dependency settings

### 3. Semantic Adapter Layer
UI must not consume raw Graph/List payloads directly. A mapping adapter converts source items into Piper-native entities such as:
- `WorkspaceTask`
- `WorkspaceProject`
- `PersonRef`
- `CommentRef`
- `ViewPreset`

### 4. Immediate Write-Through Sync
Edits should be applied in the UI quickly but persisted back to SharePoint immediately. Local cache exists for responsiveness, not as an alternate state authority.

### 5. Desktop-First Runtime
Portable/shared distribution is supported, but tokens/cache/runtime state should live in OS-appropriate app storage rather than in the shared folder.

## Core Subsystems

### Workspace Loader
Responsibilities:
- discover/load workspace configs
- validate config with schema
- register available workspaces in app
- support portable and installed modes

Current phase 1 contract lives in:
- `docs/specs/workspace-config.md`
- `src/features/workspaces/schema.ts`
- `src/features/workspaces/loaders.ts`
- `src/features/workspaces/fixtures/core-ops.workspace.json`

The contract is intentionally centered on a few durable concepts:
- stable workspace, tenant, site, and list identifiers with human-readable labels
- separate project and task list definitions
- semantic field mappings per list
- per-field renderer mappings
- saved view presets
- optional hierarchy, parent-task, and dependency mappings

### Graph Adapter
Responsibilities:
- fetch list metadata/schema
- fetch items and comments
- patch items
- normalize people/lookup/date/choice values
- shield UI from Graph quirks

### Mapping Engine
Responsibilities:
- bind semantic fields to source columns
- determine renderer/editor type
- determine which fields are filterable/sortable/groupable
- expose view-friendly entities

### View Engine
Responsibilities:
- render list/kanban/gantt/my-tasks/calendar/dashboard presets
- honor saved filters, grouping, swimlanes, visible fields
- keep view definitions decoupled from raw source fields

### Sync Engine
Responsibilities:
- perform optimistic or near-optimistic updates
- write changes immediately to source
- refresh affected records
- handle conflict/failure recovery
- support periodic background refresh

### Detail/Comments Module
Responsibilities:
- side panel editing
- long-text rendering/editor
- comments display and submission
- parent/child relationship display
- attachments links

## Data Model Direction

### WorkspaceTask
Suggested semantic fields:
- id
- externalId
- title
- status
- assignee
- priority
- description
- labels
- startDate
- dueDate
- projectRef
- parentTaskRef (optional)
- path
- createdBy
- modifiedBy
- modifiedAt
- attachments
- comments

### WorkspaceProject
Suggested semantic fields:
- id
- projectId
- title
- owner
- status
- startDate
- dueDate
- description
- parentProjectRef
- path

## Runtime Modes

### Portable Mode
- executable distributed from shared folder
- config may live beside executable
- runtime state stored locally on the machine

### Installed Mode
- app installed locally
- multiple configs/workspaces may be imported and stored locally
- configs can still originate from shared storage

## Key Risks / Unknowns
- Microsoft comments API shape and reliability for list items
- Gantt component suitability for hierarchy + dependencies + scale
- Graph performance at higher item counts
- field-type edge cases across different team schemas
