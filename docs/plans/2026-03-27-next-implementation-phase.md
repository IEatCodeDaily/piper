# Piper — Next Implementation Phase

> Date: 2026-03-27
> Status: Planning
> Branch: main (commits a4a4781, f7d10e5)

---

## 1. Current State

### What's done

| Area | Status | Details |
|---|---|---|
| Project scaffolding | Done | Tauri 2 + React + Vite + TypeScript + shadcn/ui |
| Workspace config | Done | JSON schema, parser, validation, fixture |
| Graph adapter | Done | 7 exported mapping functions, all pure |
| Graph adapter tests | Done | **37 tests covering all 7 exports** |
| Test infrastructure | Done | Vitest + jsdom, 58 tests total |
| Task list view | Done | TanStack Table, inline editing, sorting |
| Create task modal | Done | Form with validation, mutation |
| Filter/search | Done | useFilterState hook, useSearch with debounce |
| Lint/typecheck/build | Clean | 0 errors, 1 warning (TanStack incompatible-library) |
| Auth | Stub | MSAL not wired yet |
| Real Graph API | Stub | PlaceholderGraphRepository returns mock data |

### Test coverage

| Module | Tests |
|---|---|
| `piper-graph-adapter.ts` | 37 |
| `workspace-config` | 8 |
| `use-filter-state` | 7 |
| `use-search` | 6 |
| **Total** | **58** |

### Untested modules (by priority)

| Module | Lines | Risk |
|---|---|---|
| `placeholder-graph-repository.ts` | ~319 | HIGH — orchestrates adapter + client |
| `validate-workspace-config.ts` | ~100 | MEDIUM — config validation |
| `graph-client.ts` | ~100 | LOW — mostly interface |
| `mock-graph-payloads.ts` | ~200 | LOW — test fixture data |

---

## 2. Implementation Plan (Priority Order)

### Phase A: Fill Test Gaps (Next session)

**A1. Test `placeholder-graph-repository.ts`**
- Mock `GraphClient` and verify each method calls correct adapter functions
- Test `getWorkspaceTasks`, `getWorkspaceProjects`, `getComments`
- Test `createTask`, `updateTask` mutations
- Test error handling (client throws, adapter returns malformed data)

**A2. Test `validate-workspace-config.ts`**
- Valid config passes
- Missing fields detected
- Column type mismatches flagged
- Unknown fields warned

### Phase B: Auth (MSAL Integration)

**B1. Tauri MSAL plugin or delegated auth flow**
- Research: Tauri v2 + MSAL.js or deep-link OAuth
- Implement token acquisition and refresh
- Store tokens in Tauri secure storage
- See `docs/specs/graph-integration.md` Section 3

**B2. Auth state in React**
- Auth context / provider
- Login screen / redirect
- Token injection into GraphClient

### Phase C: Real Graph API

**C1. Replace `MockGraphClient` with `FetchGraphClient`**
- Wire MSAL access token into fetch headers
- Implement pagination (nextLink handling)
- Error mapping (Graph error codes → Piper errors)

**C2. Replace `PlaceholderGraphRepository` with `GraphRepository`**
- Same interface, real HTTP calls
- Cache layer (TanStack Query handles most of this)
- Optimistic updates for mutations

### Phase D: UX Features

**D1. Board (Kanban) view**
- dnd-kit for drag-and-drop status changes
- Column config from workspace views
- See `docs/specs/` for view engine spec

**D2. Project detail / task detail views**
- Side panel or full-page detail
- Comments thread
- Checklist rendering
- Attachment links

**D3. Command surface**
- Quick-create (Cmd+K)
- Workspace switcher
- View presets

### Phase E: Desktop (Tauri)

**E1. Window management**
- Proper title bar
- System tray integration
- Window state persistence

**E2. Auto-update**
- Tauri updater plugin
- Signed updates

---

## 3. Recommended Next Steps (This Week)

1. **Test `placeholder-graph-repository.ts`** — completes the data layer test coverage
2. **Test `validate-workspace-config.ts`** — completes config layer test coverage
3. **Start MSAL auth research** — the biggest blocker for real Graph API

---

## 4. Architecture Risks

| Risk | Impact | Mitigation |
|---|---|---|
| MSAL + Tauri deep-link complexity | HIGH | Prototype auth flow before committing |
| TanStack Table + React Compiler warning | LOW | Track upstream, may need `useMemo` suppression |
| `buildGraphBackedWorkspace` hardcodes overdue date | MEDIUM | Should use `new Date().toISOString()` instead of `"2026-03-27"` |

---

## 5. Commit Log (This Session)

```
a4a4781 chore(phase3): add vitest, test infrastructure, lint fixes
f7d10e5 test(graph-adapter): add 37 tests for all 7 exported mapping functions
```
