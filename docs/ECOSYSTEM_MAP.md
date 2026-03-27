# Piper Ecosystem Map

> Reference document mapping the systems Piper depends on and integrates with.

## Core Systems

| System | Role | Relevance to Piper |
|---|---|---|
| Microsoft 365 Tenant | identity + collaboration environment | single-tenant source for users and lists |
| Microsoft Teams | user entry/distribution point | app/config distributed via shared Teams/OneDrive folder |
| OneDrive / SharePoint | shared storage | hosts config files and list data |
| Microsoft Lists | source of truth for tasks/projects | primary backend model Piper renders |
| Microsoft Graph | API access layer | Piper fetches and updates list data through delegated user auth |

## Piper Runtime Context

| Component | Role |
|---|---|
| Piper Desktop App | primary user-facing client |
| Shared Workspace Config JSON | defines list endpoints, mappings, renderers, views |
| Local Runtime Storage | token/cache/workspace metadata |

## External Libraries / Technical Dependencies

| Dependency | Purpose |
|---|---|
| Tauri | cross-platform desktop shell |
| React | application UI |
| shadcn/ui | UI system |
| TanStack Query | server-state management |
| TanStack Table | list/table rendering |
| dnd-kit | Kanban interactions |
| Markdown renderer/editor stack | rich description editing |
| Potential Gantt library | timeline planning UI |
