# Piper Foundation Phase 1 Implementation Plan

> For Hermes: use the subagent-driven-development and budget-aware-parallel-delegation workflow. Prefer GLM/ZAI-backed agent execution when available and reliable.

Goal: Turn the current visual scaffold into a real application foundation for Piper by adding a workspace config contract, semantic domain layer, reusable shell/view components, and an initial mocked data flow that the later Graph adapter can plug into.

Architecture: Keep SharePoint/Microsoft Lists as the source of truth, but establish clear application boundaries now: config schema -> semantic domain model -> repository/adapter contract -> query hooks -> reusable UI shell and placeholder views. The first implementation milestone should be fully local/mock-driven but shaped exactly like the later Graph-integrated app.

Tech Stack: Tauri v2, React 19, TypeScript, Vite, Tailwind v4, shadcn/ui-friendly components, Zod, TanStack Query, Zustand (only if needed later).

---

## Current Repo State

Already present:
- Tauri app scaffold in `src-tauri/`
- visual landing shell in `src/App.tsx`
- `Button` primitive in `src/components/ui/button.tsx`
- design system docs in `docs/DESIGN.md`
- architecture/BRD/docs scaffold in `docs/`

Missing for the next real milestone:
- config schema and runtime loader
- semantic entities for tasks/projects/workspaces
- repository/adapter boundaries
- reusable app shell components
- actual view modules (list/kanban/timeline placeholders)
- a mock workspace + sample data source
- TanStack Query provider and hooks

---

## Phase Breakdown

### Batch 1 — Independent foundation work (parallelizable)
1. Workspace config contract + sample configs
2. Domain model + mock repository + hooks foundation
3. UI shell refactor into reusable layout/components

### Batch 2 — Integration work (sequential after batch 1)
4. Wire mock workspace data into the shell
5. Build view switcher and placeholder view modules
6. Add detail panel shell and selected-item state

### Batch 3 — Graph-ready foundation (mostly sequential)
7. Add Graph adapter interfaces and placeholder implementation boundary
8. Add docs/spec updates and verification notes for future Graph integration

---

## Task 1: Create workspace config contract and fixtures

Objective: Establish the Piper workspace JSON contract with runtime validation and checked-in sample config files.

Files:
- Create: `src/features/workspaces/schema.ts`
- Create: `src/features/workspaces/types.ts`
- Create: `src/features/workspaces/loaders.ts`
- Create: `src/features/workspaces/fixtures/core-ops.workspace.json`
- Create: `src/features/workspaces/fixtures/index.ts`
- Create: `docs/specs/workspace-config.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/specs/FEATURE_MAP.md`

Implementation requirements:
- Use Zod for runtime schema validation.
- Support stable IDs and human-readable labels.
- Support task list + project list definitions.
- Support semantic field mapping.
- Support renderer mapping.
- Support saved view presets.
- Support optional parent-task mapping and optional dependency mapping.
- Provide one realistic sample config matching the current known Piper discussion.

Verification:
- `bun run typecheck`
- Example fixture imports cleanly from TypeScript

Commit message target:
- `feat(workspaces): add config schema and sample workspace fixtures`

---

## Task 2: Create semantic domain model, mock repository, and query layer

Objective: Add Piper-native entities and a mock repository/hook layer so future UI can consume semantic data rather than raw source payloads.

Files:
- Create: `src/features/tasks/types.ts`
- Create: `src/features/projects/types.ts`
- Create: `src/features/comments/types.ts`
- Create: `src/features/people/types.ts`
- Create: `src/lib/domain/workspace.ts`
- Create: `src/lib/repository/piper-repository.ts`
- Create: `src/lib/repository/mock-piper-repository.ts`
- Create: `src/lib/query/query-client.ts`
- Create: `src/lib/query/query-keys.ts`
- Create: `src/features/workspaces/hooks/use-active-workspace.ts`
- Create: `src/features/tasks/hooks/use-workspace-tasks.ts`
- Create: `src/features/projects/hooks/use-workspace-projects.ts`
- Create: `src/features/tasks/fixtures/tasks.ts`
- Create: `src/features/projects/fixtures/projects.ts`
- Create: `src/features/comments/fixtures/comments.ts`
- Modify: `package.json`
- Modify: `src/main.tsx`

Implementation requirements:
- Add TanStack Query.
- Define semantic entities for workspace, task, project, person, comment.
- Add `PiperRepository` interface for later Graph implementation.
- Add mock repository implementation returning realistic typed data.
- Provide query hooks that consume the repository.
- Make the repository injectable through a simple provider or module-level default.

Verification:
- `bun run lint`
- `bun run typecheck`
- `bun run build:web`

Commit message target:
- `feat(data): add Piper domain models and mock repository`

---

## Task 3: Refactor app into reusable shell and layout components

Objective: Replace the one-file landing page with a reusable app shell that matches Piper’s design language and can host real views.

Files:
- Create: `src/components/layout/app-shell.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/topbar.tsx`
- Create: `src/components/layout/workspace-switcher.tsx`
- Create: `src/components/layout/navigation.tsx`
- Create: `src/components/layout/surface-card.tsx`
- Create: `src/components/layout/status-pillar.tsx`
- Create: `src/components/layout/section-header.tsx`
- Create: `src/components/icons/piper-logo.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

Implementation requirements:
- Preserve the current “Precision Engine” look and feel.
- Move repeated UI blocks into reusable components.
- Keep the no-line tonal surface strategy.
- Expose slots/props for views and right rail panels.
- Add navigation structure for Workspace, List, Kanban, Timeline, My Tasks.
- Keep it mock-driven for now.

Verification:
- `bun run lint`
- `bun run typecheck`
- `bun run build:web`

Commit message target:
- `feat(shell): refactor landing page into reusable Piper app shell`

---

## Task 4: Integrate active workspace and mocked data into the shell

Objective: Connect the shell to real typed mock data and selected workspace state.

Files:
- Create: `src/features/workspaces/state/use-workspace-store.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/workspace-switcher.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/topbar.tsx`

Implementation requirements:
- Add active-workspace state.
- Populate switcher from fixture configs.
- Show workspace metadata in shell.
- Use query hooks instead of inline hardcoded arrays.

Verification:
- `bun run lint`
- `bun run typecheck`

Commit message target:
- `feat(workspaces): connect shell to active workspace state`

---

## Task 5: Add real view modules and view switching

Objective: Replace the placeholder center panel with actual view modules backed by the mock repository.

Files:
- Create: `src/features/views/types.ts`
- Create: `src/features/views/view-switcher.tsx`
- Create: `src/features/views/list-view.tsx`
- Create: `src/features/views/kanban-view.tsx`
- Create: `src/features/views/timeline-view.tsx`
- Create: `src/features/views/my-tasks-view.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/navigation.tsx`

Implementation requirements:
- View switching should be app-local state for now.
- List view should render real mock tasks in a high-density table.
- Kanban/timeline can be placeholder-but-structured panels using real grouped data.
- My Tasks view filters assignee-specific mock data.

Verification:
- `bun run lint`
- `bun run typecheck`
- `bun run build:web`

Commit message target:
- `feat(views): add mock-backed Piper workspace views`

---

## Task 6: Add detail panel shell and selected item state

Objective: Create the structural basis for Linear-style item inspection/editing.

Files:
- Create: `src/features/selection/state/use-selection-store.ts`
- Create: `src/features/details/task-detail-panel.tsx`
- Create: `src/features/details/comment-thread.tsx`
- Create: `src/features/details/field-list.tsx`
- Modify: `src/features/views/list-view.tsx`
- Modify: `src/features/views/kanban-view.tsx`
- Modify: `src/components/layout/app-shell.tsx`

Implementation requirements:
- Selecting an item should open a right-side panel.
- The detail panel should render description, metadata, and flat comments from fixtures.
- Editing can remain read-only shell for now, but structure should be ready for editable controls.

Verification:
- `bun run lint`
- `bun run typecheck`
- `bun run build:web`

Commit message target:
- `feat(details): add task detail side panel shell`

---

## Task 7: Add Graph adapter boundaries and placeholder implementation

Objective: Prepare the codebase for delegated Microsoft Graph integration without actually wiring auth yet.

Files:
- Create: `src/lib/graph/types.ts`
- Create: `src/lib/graph/piper-graph-adapter.ts`
- Create: `src/lib/graph/placeholder-graph-repository.ts`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/specs/FEATURE_MAP.md`

Implementation requirements:
- Define raw-source shapes only as boundary types.
- Keep Graph-specific code out of view components.
- Show how a Graph repository would satisfy `PiperRepository`.

Verification:
- `bun run typecheck`

Commit message target:
- `feat(graph): add Graph repository boundary for future integration`

---

## Task 8: Final documentation and verification pass

Objective: Make the foundation implementation self-explanatory and ready for the next implementation phase.

Files:
- Modify: `README.md`
- Modify: `docs/DEVELOPMENT.md`
- Modify: `docs/changelog.mdx`
- Create: `docs/specs/mock-data-and-shell.md`

Verification:
- `bun run lint`
- `bun run typecheck`
- `bun run build:web`
- `cargo check --manifest-path src-tauri/Cargo.toml`

Commit message target:
- `docs(app): document Piper foundation architecture and workflow`

---

## Parallel Execution Strategy

Batch 1 can run in parallel because file overlap is low if each task is scoped tightly:
- Task 1 branch: workspace schema/docs only
- Task 2 branch: domain/repository/query foundation
- Task 3 branch: UI shell refactor only

After Batch 1:
- Review each branch
- cherry-pick or merge into the main working branch
- run verification
- then execute Tasks 4-6 sequentially or in smaller batches

## Review Rules

For every implementation batch:
1. spec compliance review
2. code quality review
3. controller verification in the main branch
4. commit only after lint/typecheck/build pass

## Immediate Next Execution Target

Implement Batch 1 now using a team of GLM-preferred coding agents where possible.
