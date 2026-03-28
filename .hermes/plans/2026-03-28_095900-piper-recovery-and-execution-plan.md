# piper recovery and execution plan

## Goal
Move Piper from partially healthy WIP to release-safe momentum by finishing the current workspace-view work, restoring full build health, and then resuming the product roadmap from a stable base.

## Current context
Observed state from repo inspection:
- Repo: `/home/rpw/repo/piper`
- Branch: `main`, ahead of origin by several commits
- Current WIP is centered on a new `WorkspaceStreamView`
- Tests and typecheck pass
- Lint passes except for one existing TanStack Table warning
- Build is **not** fully green

## High-confidence findings
### Active WIP
Files currently involved:
- `src/features/views/view-switcher.tsx`
- `src/features/views/workspace-stream-view.tsx` (new, untracked when inspected)
- `docs/specs/FEATURE_MAP.md`
- `src-tauri/Cargo.toml`

### What the WIP is doing
- introducing a dedicated workspace stream/activity view
- switching the `workspace` case away from `ListView`
- cleaning/updating feature map docs
- tweaking Tauri feature declarations

### Validation state
Healthy:
- `npm test` passes
- `npm run typecheck` passes
- `npm run lint` passes with one existing warning

Unhealthy:
- `npm run build:web` fails due to TypeScript/build issues
- full `npm run build` / Tauri path is also blocked by `bun` not being installed in this environment

## Build blockers to fix first
### Blocker 1 — current view-switcher integration is incomplete
Likely issues identified:
- duplicate `WorkspaceStreamView` import(s)
- `ListView` still referenced but not imported for the non-workspace case

### Blocker 2 — unrelated but real build errors already present
Examples found by inspection summary:
- `workspace-config.test.ts` type mismatches
- `placeholder-graph-repository.ts` returns a task shape missing required `workspaceId` on one path

These must be fixed before Piper can be considered reliably shippable.

## Proposed execution order

### Step 1 — Finish the workspace view integration
Focus files:
- `src/features/views/view-switcher.tsx`
- `src/features/views/workspace-stream-view.tsx`

Objectives:
1. make `workspace` and `list` routing explicit and correct
2. fix imports and switch logic
3. confirm selection behavior and empty states
4. ensure no regressions in existing views

Validation target:
- `npm run typecheck`
- `npm test`
- `npm run lint`
- targeted manual/UI verification of workspace view

### Step 2 — Restore full web build health
Focus likely files:
- `src/features/views/view-switcher.tsx`
- `src/lib/graph/placeholder-graph-repository.ts`
- failing test/config files such as `workspace-config.test.ts`

Objectives:
1. eliminate all `build:web` TypeScript failures
2. keep tests green while doing so
3. re-establish build as a required gate

Validation target:
- `npm run build:web` passes cleanly
- if environment supports it, full `npm run build` passes too

### Step 3 — Reconcile docs with actual project state
Focus files:
- `docs/specs/FEATURE_MAP.md`
- next-phase planning docs that still describe already-completed testing gaps

Objectives:
1. remove stale roadmap assumptions
2. accurately reflect current test coverage and completed feature work
3. make planning docs trustworthy again

Validation target:
- docs match current implementation/tests
- no malformed markdown or duplicated stale sections

### Step 4 — Decide whether Cargo.toml change belongs in this slice
Focus file:
- `src-tauri/Cargo.toml`

Objectives:
1. keep if required for build/config correctness
2. otherwise separate from UI work to reduce review noise

Validation target:
- each change in the active branch has a clear purpose

### Step 5 — Resume product roadmap only after build is green
Recommended next product priorities after recovery:
1. auth hardening / real auth wiring
2. Graph + SharePoint Lists integration implementation
3. roadmap items that depend on real workspace/task sync

## Recommended implementation slices
1. `workspace-stream-view-finish`
2. `build-web-green`
3. `docs-roadmap-reconcile`
4. `graph-integration-foundation`

## Risks
- shipping from a repo that has green tests but red build is a trap
- continuing feature work before `build:web` is clean will stack hidden integration debt
- stale planning docs can send implementation in the wrong direction

## Success criteria
- workspace view lands cleanly
- tests, typecheck, lint, and `build:web` are all green
- docs accurately describe current capability
- next roadmap work can begin from a release-safe baseline
