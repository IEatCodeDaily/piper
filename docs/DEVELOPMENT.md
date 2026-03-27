# Piper — Development Guide

## Prerequisites

- Bun (preferred JavaScript package manager)
- Node.js 20+
- Rust toolchain (for Tauri)
- Tauri prerequisites for your OS
- Microsoft 365 tenant access for integration testing

## Setup

```bash
git clone git@github.com:IEatCodeDaily/piper.git
cd piper

# Install dependencies after scaffold exists
bun install

# Start dev app (after scaffold exists)
bun run dev
```

## Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start Tauri desktop development workflow |
| `bun run dev:web` | Start Vite frontend only on port 1420 |
| `bun run build` | Build the Tauri desktop app |
| `bun run build:web` | Build the frontend bundle only |
| `bun run lint` | Lint check |
| `bun run typecheck` | TypeScript typecheck |
| `bun run test` | Test suite |

## Development Workflow

### 1. Feature Development (TDD)

See [ADR-002: TDD Policy](./adr/002-tdd-policy.md).

```
1. Create feature spec in docs/specs/{feature-name}.md
2. Add/update UX notes if interaction changes
3. Write failing tests first
4. Implement until tests pass
5. Update ARCHITECTURE.md if the system design changed
6. Create ADR if an architectural decision was made
7. Update changelog if user-visible
```

### 2. Frontend Coding Patterns
- Use TanStack Query for external/server state.
- Keep Microsoft API logic inside adapter modules.
- Avoid leaking raw Graph payload shapes into components.
- Use shadcn/ui primitives and consistent composition patterns.
- Keep semantic field/rendering logic in mapping modules, not scattered across components.

### 2a. Graph integration notes
- Keep all raw Microsoft Graph and SharePoint List types inside `src/lib/graph/`.
- Use `PlaceholderGraphRepository` or `MockPiperRepository` behind the shared `PiperRepository` contract.
- Wire delegated auth into `FetchGraphClient` by supplying an access-token provider instead of calling `fetch` directly from features.
- Update `docs/specs/graph-integration.md` when Graph boundary types or repository behavior changes.

### 3. Config Changes
When changing workspace config shape:
```bash
# update schema + docs together
# update fixtures/tests
# update docs/config references in specs/architecture
```

### 4. Verification Checklist
Before every PR:
- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] `bun run build` succeeds
- [ ] Docs updated where needed
- [ ] Config/schema changes documented
- [ ] No leftover debug logging in production code
