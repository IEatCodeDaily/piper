# ADR-001: Tech Stack — Tauri + React + Microsoft Graph

**Status:** Accepted
**Date:** 2026-03-27
**Author:** Raisal / Zephyr
**Deciders:** Engineering Team

## Context

Piper needs to be a cross-platform desktop app for Windows and macOS, distributed simply to a small technical team, while keeping Microsoft Lists / SharePoint Lists as the source of truth and providing a much better day-to-day UX.

## Decision

### Desktop Runtime
- **Shell:** Tauri v2
- **Distribution:** support portable-friendly and installed modes

### Frontend
- **Framework:** React + TypeScript + Vite
- **UI:** shadcn/ui + Tailwind CSS
- **State:** TanStack Query + lightweight local UI state
- **Table/Grid:** TanStack Table
- **Drag and Drop:** dnd-kit
- **Markdown:** markdown-capable render/edit stack

### Data & Integration
- **Auth:** Microsoft delegated user login
- **API access:** Microsoft Graph / SharePoint Lists APIs
- **Config:** JSON workspace configuration with stable IDs and labels
- **Runtime cache:** local OS app storage

## Consequences

### Positive
- Tauri keeps the app lightweight relative to Electron
- React + shadcn/ui supports the desired Linear-like UX direction
- Direct Graph integration avoids introducing a backend service too early
- Config-driven design supports multiple team schemas without code changes

### Negative
- Graph/List APIs can be awkward and require adapter code
- Cross-platform desktop packaging introduces native runtime concerns
- Gantt quality depends partly on third-party component viability

### Risks
- Microsoft auth setup may still require tenant app registration work
- Comments and list-specific API behavior need validation early
- Direct Graph fetching may need careful caching/pagination at scale

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Electron + React | Mature ecosystem | Heavier footprint | Tauri better fits thin desktop client |
| Web app only | Simpler deployment | Worse fit for portable/shared desktop use | Desktop app is the intended usage model |
| Custom backend + DB mirror first | More control | More complexity and ops | Premature for v1 |
| Generic low-code wrapper | Faster initial shell | Less control over UX | Piper needs stronger opinionated UX |

## References

- [BRD](../BRD.md)
- [Architecture](../ARCHITECTURE.md)
