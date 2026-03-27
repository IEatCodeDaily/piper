# Piper — AI Agent Guidelines

## Identity

Piper is a configurable desktop task and project management app built on top of Microsoft Lists / SharePoint Lists. It provides a better day-to-day UX than raw Teams/Microsoft Lists while keeping SharePoint Lists as the source of truth.

**Architecture:** Tauri desktop shell + React frontend + direct Microsoft delegated auth + Microsoft Graph / SharePoint Lists.
**Primary goal:** Make project/task management feel closer to Linear/Jira while remaining configuration-driven and lightweight.

---

## Rules of Engagement

### 1. Understand First
- Always clarify requirements until the implementation scope is clear.
- Read the relevant feature spec in `docs/specs/` before implementing.
- Check `docs/adr/` for existing architectural decisions that constrain the approach.
- Treat the workspace config schema as a core contract. Changes to config shape require documentation updates.

### 2. Ground Truth
- **Requirements**: `docs/BRD.md` defines scope and priorities.
- **Architecture**: `docs/ARCHITECTURE.md` for system design.
- **Development**: `docs/DEVELOPMENT.md` for setup and workflow.
- **Testing**: `docs/TESTING.md` for test strategy.
- **Ecosystem**: `docs/ECOSYSTEM_MAP.md` for external systems and dependencies.
- **Feature Inventory**: `docs/specs/FEATURE_MAP.md` for tracked features.
- **UX Design**: `docs/ux/` for wireframes and user flows.
- **Design System**: `docs/DESIGN.md` for Piper visual language and interaction styling.

### 3. Test-Driven Development (TDD) — MANDATORY

See [ADR-002: TDD Policy](./docs/adr/002-tdd-policy.md).

**The order is non-negotiable:**
1. **Lint/typecheck first** — fix static issues before feature work.
2. **Write failing tests** — unit/component/integration tests FIRST.
3. **Implement** — write code until tests pass.
4. **Refactor** — improve code while keeping tests green.

**Expected verification commands:**
```bash
# From repo root
bun run lint
bun run typecheck
bun run test
bun run build
```

### 4. Documentation — MANDATORY

See [ADR-003: Documentation Structure](./docs/adr/003-documentation-structure.md).

Before implementing a feature:
- [ ] Feature spec exists in `docs/specs/{feature-name}.md`
- [ ] UX notes or mockups exist if the feature changes core interaction flows

After implementing:
- [ ] `docs/ARCHITECTURE.md` updated if system design changed
- [ ] ADR created if an architectural decision was made
- [ ] `docs/changelog.mdx` updated for user-visible changes

### 5. Verification — ALWAYS before committing

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

---

## Technical Architecture

### App Rules (Tauri + React)
- **Desktop-first**: Piper is a desktop app, not a web SaaS. Optimize for long-running daily use.
- **Source of Truth**: Microsoft Lists / SharePoint Lists remain the source of truth. Do not introduce a separate application database for core domain data.
- **Delegated Auth**: Use signed-in user Microsoft permissions. Avoid service-account assumptions.
- **Config-Driven**: Workspaces, mappings, renderers, and view presets are driven by config files rather than hardcoded per customer/team.
- **Semantic Mapping Layer**: UI components must consume Piper-native semantic entities, not raw Graph payloads.
- **Immediate Sync**: User edits should write back to SharePoint promptly; local cache is for responsiveness, not divergence.
- **Portable-Friendly**: Shared configs may live beside the executable, but runtime cache/token state should live in OS-appropriate app storage.

### Frontend Rules
- **Framework**: React + TypeScript + Vite.
- **UI System**: shadcn/ui + Tailwind.
- **State**: TanStack Query for server state, Zustand only for local UI state when needed.
- **Tables**: TanStack Table.
- **DnD**: dnd-kit.
- **Markdown**: Use markdown-capable rendering/editor flow for long text fields where configured.
- **Command Surface**: Quick-create and workspace switching should be globally accessible.

### Data/Integration Rules
- **Microsoft Graph Adapter**: Centralize all Graph/List API logic in a dedicated adapter layer.
- **Workspace Config Contract**: Config must support stable IDs for site/list identity and human-readable labels.
- **Comments**: Flat comments only for v1; use existing Microsoft List comments where supported.
- **Hierarchy**: Project parent-child is supported; task parent-child is optional/configurable until backed by source fields.
- **Dependencies**: Do not assume dependency support unless configured by a dedicated field.

---

## Process Guidelines

### Commits
Follow [Git Karma](https://karma-runner.github.io/6.4/dev/git-commit-msg.html):
```
feat(workspace): add shared config loader
feat(views): add kanban drag-and-drop status updates
fix(graph): handle missing person field avatars
docs(adr): add ADR-001 for Tauri stack
chore(tooling): add bun scripts and lint config
```

### Branching
- `feature/{description}` — New features
- `bugfix/{description}` — Bug fixes
- `chore/{description}` — Maintenance, tooling, deps
- `docs/{description}` — Documentation only

### PR Checklist
- [ ] Tests written FIRST (TDD)
- [ ] `bun run lint` passes
- [ ] `bun run typecheck` passes
- [ ] `bun run test` passes
- [ ] `bun run build` succeeds
- [ ] Docs updated (specs, ARCHITECTURE.md, ADRs, changelog)
- [ ] No leftover debug logs in production code
- [ ] Config/schema changes documented

### Architecture Decisions
Any architectural decision (auth flow, config format, adapter design, view engine strategy, sync behavior, Gantt provider choice) **MUST** be recorded as an ADR in `docs/adr/`. Use the template at `docs/adr/000-template.md`.

---

## Project Structure

```
piper/
├── AGENTS.md                       # THIS FILE — AI agent guidelines
├── README.md                       # Repo overview
├── docs/                           # Documentation
│   ├── BRD.md                      # Business requirements
│   ├── ECOSYSTEM_MAP.md            # External systems and dependencies
│   ├── ARCHITECTURE.md             # System design
│   ├── DEVELOPMENT.md              # Dev guide
│   ├── TESTING.md                  # Test strategy
│   ├── changelog.mdx               # User-visible changes
│   ├── adr/                        # Architecture Decision Records
│   ├── specs/                      # Feature specifications
│   ├── plans/                      # Implementation plans
│   ├── mistakes/                   # Post-mortem learnings
│   ├── ux/                         # UX designs and user flows
│   └── legacy/                     # Imported references / prior analysis if needed
└── .github/                        # CI workflows (to be added)
```

---

## Known Mistakes & Pitfalls

> Every significant bug or mistake that caused rework should be summarized here and expanded in `docs/mistakes/`.

<!-- Template for adding mistakes:
### [DATE] Short Description
**What happened:** ...
**Root cause:** ...
**Prevention:** ...
**Post-mortem:** [docs/mistakes/YYYY-MM-DD-slug.md](./docs/mistakes/YYYY-MM-DD-slug.md)
-->

---

## References

- [Business Requirements](./docs/BRD.md)
- [Ecosystem Map](./docs/ECOSYSTEM_MAP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Testing Strategy](./docs/TESTING.md)
- [Feature Map](./docs/specs/FEATURE_MAP.md)
