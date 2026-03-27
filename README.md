# Piper

Piper is a configurable desktop task and project management app built on top of Microsoft Lists / SharePoint Lists.

Goals:
- Better UI/UX than Teams/Microsoft Lists
- Config-driven field mapping and workspaces
- List, Kanban, and Gantt views
- Direct delegated Microsoft login via user account
- Immediate sync back to SharePoint Lists

## Stack
- Tauri v2
- React + TypeScript + Vite
- shadcn/ui-friendly component foundation
- Tailwind CSS v4
- Microsoft Graph / SharePoint Lists integration (planned)

## Development
```bash
cd ~/repo/piper
bun install
bun run dev
```

Repository modes:
- default mock repository: `bun run dev`
- Graph-style placeholder repository: `VITE_PIPER_REPOSITORY_MODE=graph-mock bun run dev`

## Documentation
- `AGENTS.md`
- `docs/BRD.md`
- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `docs/TESTING.md`
- `docs/DESIGN.md`
- `docs/specs/FEATURE_MAP.md`
- `docs/specs/workspace-config.md`
- `docs/specs/graph-integration.md`
