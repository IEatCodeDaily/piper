# Piper — Feature Map

> Master list of features grouped by domain, with priority and status.
> Source: BRD v0.1.0

---

## Domain 1: Workspace & Configuration

| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| WS1 | Load workspace config from JSON | P0 | Done | Phase 1 schema, loader helpers, and sample fixture added |
| WS2 | Stable IDs + human-readable labels in config | P0 | Done | Contract now requires stable tenant/site/list IDs plus labels |
| WS3 | Portable mode config beside executable | P0 | Planned | |
| WS4 | Installed mode with multiple workspaces | P1 | Planned | |
| WS5 | Config import/export as JSON | P1 | Planned | |
| WS6 | Config setup wizard with preview | P1 | Planned | |

---

## Domain 2: Mapping & Rendering

| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| MP1 | Semantic field mapping for tasks/projects | P0 | Done | Phase 1 config contract defines separate task/project semantic mappings |
| MP2 | Configure per-field renderers | P0 | Done | Renderer mapping contract defined per semantic field |
| MP3 | Person/choice/date/markdown/lookup renderers | P0 | Done | Graph boundary and normalizes person/lookup/date/choice payloads into Piper semantics |
    MP4 | Configurable colors for status/choice fields | P1 | Planned | |
| MP5 | View-specific field visibility/grouping | P1 | Planned | |

---

## Domain 3: Core Views

| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| CV1 | List/table view | P0 | Done | TanStack Table with sorting, filterable columns |
| CV2 | Inline edit in list/table | P0 | Done | TanStack Table with editable cells |
| CV3 | Kanban with drag-and-drop | P0 | Done | dnd-kit with optimistic updates |
| CV4 | Configurable swimlanes/grouping | P1 | Planned | |
| CV5 | Gantt/timeline | P1 | Planned | evaluate provider carefully |
| CV6 | My Tasks | P1 | Done | Filtered by assignee |
| CV7 | Calendar | P2 | Planned | |
| CV8 | Dashboard | P2 | Planned | |
| CV9 | Project summary | P2 | Planned | |

---

## Domain 4: Detail & Collaboration

| ID | Feature | Priority | Status | Notes |
|----|---------|----------|--------|-------|
| DC1 | Item detail side panel | P0 | Done | Phase 1 shell exists |
| DC2 | Rich description rendering/editing | P0 | Done | Markdown editor with preview/edit mode |
| DC3 | Flat Microsoft List comments | P1 | In Progress | Graph boundary includes realistic comment payloads |
| DC4 | Parent/child relationship display | P1 | Planned | task parent optional |
| DC5 | External attachment open | P1 | Planned | |
| DC6 | Quick-create task | P1 | Done | Sidebar/global action |

|----|---------|----------|--------|-------|

| WS1 | Load workspace config from JSON | P0 | Done | Phase 1 |
| WS2 | Stable IDs + human-readable labels in config | P0 | Done |
| WS3 | Portable mode config beside executable | P0 | Planned |
| WS4 | Installed mode with multiple workspaces | P1 | Planned |
| WS5 | Config import/export as JSON | P1 | Planned |
| WS6 | Config setup wizard with preview | P1 | Planned | | |
| WS2 | Saved/shared views | P0 | Done | View preset contract added |
| SF1 | Filter by any configured field | P0 | Done | Filter bar with multi-select chips |
| SF2 | Saved/shared views | P0 | In Progress | View preset contract exists |
| SF3 | Search by title/metadata | P0 | Done | Debounced search (300ms) |
| DC2 | Quick-create task | P1 | Done | Sidebar "Quick create" button + Cmd+K shortcut |
| DC6 | Quick-create task modal | P1 | Done | opens modal on success |
| CV1-CV9 | List/Table view now supports sorting and filtering with TanStack Table"
- Kanban view has drag-and-drop status updates
- Detail panel is fully interactive with editable fields
- Global search is functional with debounced input
- Quick-create modal works via sidebar button

- Filter bar applies filters to all views
- Search works with 300ms debounce
- Inline editing cells for status, priority, due date
- description
- labels
- my tasks view filters by assignee

- My-tasks view filters to assignee
- timeline view is still placeholder (needs Gantt library)
- Gantt/timeline view needs evaluation ( needs real date ranges
- project summary view needs parent/child relationship display
    Calendar view (P2)
    Dashboard view (P2)
    project summary view (P2)
- Tests! (no tests yet - follow TDD policy)
- Documentation updates (ARCHITECTURE, FEATURE map)
- Git commit

- Phase 2 complete"
