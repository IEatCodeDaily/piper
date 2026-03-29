# Piper Phase 2: Interactive Views Implementation Plan

> Goal: Transform static placeholder views into fully interactive, editable views with real data manipulation.

## Current State (Phase 1 Complete)

- Static views: ListView, KanbanView, TimelineView, MyTasksView
- Read-only detail panel
- Mock repository with real data shapes
- Graph adapter boundary (not wired to auth)

## Phase 2 Tasks

---

### Batch 1: Core View Infrastructure (Parallel)

These tasks are independent and can run simultaneously.

#### Task 1: TanStack Table Integration

**Objective:** Replace custom grid with TanStack Table for sorting/filtering support.

**Files:**
- Create: `src/lib/table/table-config.ts` - column definitions helper
- Create: `src/lib/table/filter-state.ts` - filter state management
- Modify: `src/features/views/list-view.tsx` - use TanStack Table
- Modify: `package.json` - add @tanstack/react-table

**Requirements:**
- Add @tanstack/react-table dependency
- Create typed column definitions from WorkspaceTask type
- Implement sortable columns (title, status, assignee, due date, priority)
- Implement filterable columns (status, assignee, project)
- Preserve existing visual design (status pillar, truncation, badges)
- Add column header sort indicators

**Verification:**
```bash
bun install
bun run typecheck
bun run build:web
```

**Commit:** `feat(views): integrate TanStack Table with sorting and filtering`

---

#### Task 2: dnd-kit Kanban Drag-and-Drop

**Objective:** Enable drag-and-drop task cards between status columns.

**Files:**
- Create: `src/features/views/kanban-dnd-context.tsx` - DnD context wrapper
- Create: `src/features/views/kanban-column.tsx` - Droppable column component
- Create: `src/features/views/kanban-card.tsx` - Draggable card component
- Modify: `src/features/views/kanban-view.tsx` - use DnD components
- Modify: `src/features/tasks/hooks/use-update-task.ts` - ensure optimistic updates work
- Modify: `package.json` - add @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities

**Requirements:**
- Add dnd-kit dependencies
- Create DndContext wrapper with sensors (pointer, keyboard)
- Make columns drop zones
- Make cards draggable
- On drop: call updateTask mutation with new status
- Optimistic update: immediately move card in UI
- Visual feedback during drag (opacity, shadow)
- Preserve column layout and styling

**Verification:**
```bash
bun install
bun run typecheck
bun run build:web
```

**Commit:** `feat(kanban): add drag-and-drop status updates with dnd-kit`

---

#### Task 3: Filter Bar Component

**Objective:** Add filter controls above views for status, assignee, project.

**Files:**
- Create: `src/features/filters/types.ts` - filter state types
- Create: `src/features/filters/filter-bar.tsx` - filter UI component
- Create: `src/features/filters/filter-chip.tsx` - individual filter chip
- Create: `src/features/filters/use-filter-state.ts` - filter state hook
- Modify: `src/App.tsx` - add filter bar above ViewSwitcher
- Modify: `src/features/views/view-switcher.tsx` - accept and apply filters

**Requirements:**
- Filter state: status[], assigneeId[], projectId[]
- Multi-select chips for each filter type
- Clear all filters button
- Filter chips show count of active filters
- Filters apply to all views (list, kanban, my-tasks)
- Persist filter state in URL params (optional, can be Phase 3)

**Verification:**
```bash
bun run typecheck
bun run build:web
```

**Commit:** `feat(filters): add filter bar with multi-select chips`

---

### Batch 2: Editing & Interaction (Sequential after Batch 1)

#### Task 4: Inline Editing in List View

**Objective:** Enable inline cell editing for title, status, priority, due date.

**Files:**
- Create: `src/features/views/cells/editable-cell.tsx` - editable cell wrapper
- Create: `src/features/views/cells/status-cell.tsx` - status dropdown
- Create: `src/features/views/cells/priority-cell.tsx` - priority dropdown
- Create: `src/features/views/cells/date-cell.tsx` - date picker cell
- Create: `src/features/views/cells/text-cell.tsx` - inline text edit
- Modify: `src/features/views/list-view.tsx` - use editable cells

**Requirements:**
- Double-click or Enter to edit
- Escape to cancel
- Enter/blur to save
- Dropdown for status (backlog, planned, in-progress, blocked, done)
- Dropdown for priority (critical, high, medium, low)
- Date picker for due date
- Text input for title
- Optimistic update on save
- Show loading state during mutation

**Verification:**
```bash
bun run typecheck
bun run build:web
```

**Commit:** `feat(list): add inline editing for task fields`

---

#### Task 5: Interactive Detail Panel

**Objective:** Make the detail panel fully interactive with editable fields.

**Files:**
- Modify: `src/features/details/task-detail-panel.tsx` - make fields editable
- Modify: `src/features/details/field-list.tsx` - add edit modes
- Create: `src/features/details/editable-field.tsx` - generic editable field
- Create: `src/features/details/markdown-editor.tsx` - description editor
- Modify: `src/features/comments/hooks/use-create-comment.ts` - wire to panel

**Requirements:**
- Title: inline edit
- Description: markdown editor (can use simple textarea for now)
- Status: dropdown
- Priority: dropdown
- Assignee: person picker (dropdown from workspace people)
- Due date: date picker
- Labels: multi-select or tag input
- Comments: text input + submit button
- All edits call updateTask mutation
- Optimistic updates with rollback on error

**Verification:**
```bash
bun run typecheck
bun run build:web
```

**Commit:** `feat(details): add interactive editing to detail panel`

---

### Batch 3: Search & Polish (Sequential after Batch 2)

#### Task 6: Global Search

**Objective:** Add search functionality to filter tasks by title and metadata.

**Files:**
- Create: `src/features/search/search-input.tsx` - search input component
- Create: `src/features/search/use-search.ts` - search hook with debounce
- Modify: `src/components/layout/topbar.tsx` - integrate search input
- Modify: `src/App.tsx` - apply search filter to tasks

**Requirements:**
- Search input in topbar
- Debounce input (300ms)
- Search task title, external ID, description
- Highlight matching text (optional)
- Clear search button
- Search applies globally across all views
- Show result count

**Verification:**
```bash
bun run typecheck
bun run build:web
```

**Commit:** `feat(search): add global task search`

---

#### Task 7: Quick Create Task Modal

**Objective:** Add quick-create button to create tasks from anywhere.

**Files:**
- Create: `src/features/create/create-task-modal.tsx` - modal component
- Create: `src/features/create/use-create-task.ts` - create mutation hook
- Modify: `src/components/layout/sidebar.tsx` - trigger from quick create button

**Requirements:**
- Modal with title input (required)
- Optional: project, assignee, status, priority
- Keyboard shortcut: Cmd/Ctrl + K (optional, can be Phase 3)
- Create mutation with optimistic update
- Close modal on success
- Focus title input on open

**Verification:**
```bash
bun run typecheck
bun run build:web
```

**Commit:** `feat(create): add quick-create task modal`

---

## Execution Strategy

### Batch 1 (Parallel - 3 subagents)
- Task 1: TanStack Table
- Task 2: dnd-kit Kanban
- Task 3: Filter Bar

### Batch 2 (Sequential - 2 subagents)
- Task 4: Inline Editing (after Batch 1 complete)
- Task 5: Interactive Detail Panel (after Task 4)

### Batch 3 (Sequential - 2 subagents)
- Task 6: Global Search (after Batch 2 complete)
- Task 7: Quick Create Modal (after Task 6)

## Verification Commands

After each batch:
```bash
bun run lint
bun run typecheck
bun run build:web
```

## Dependencies to Add

```json
{
  "@tanstack/react-table": "^8.21.0",
  "@dnd-kit/core": "^6.3.0",
  "@dnd-kit/sortable": "^9.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```
