# Piper — Business Requirements Document

**Version:** 0.1.0
**Date:** 2026-03-27
**Author:** Raisal / Zephyr
**Status:** Draft

---

## 1. Executive Summary

Piper is a configurable desktop workspace for project and task management built on top of Microsoft Lists / SharePoint Lists. It preserves Microsoft 365 as the source of truth while providing a significantly better interaction model for planning and execution.

Piper is intended to make Microsoft Lists feel closer to Linear/Jira for teams that already store project and task data in Teams/SharePoint Lists.

---

## 2. Problem Statement

### Current Pain Points
1. Microsoft Lists inside Teams is functional but not enjoyable for daily project/task work.
2. Native list views are weak for rich task detail, hierarchy, Kanban workflows, and interactive planning.
3. Teams/SharePoint UI is too generic; users need a focused project/task workspace.
4. Field schemas differ across teams, so hardcoded mappings are brittle.
5. Users want the flexibility of SharePoint data governance without losing modern UX.

### Impact
- Teams avoid using the system consistently when the UI is frustrating.
- Planning workflows like Kanban and Gantt are harder than they should be.
- Rich descriptions and comments are less usable than in dedicated PM tools.
- Teams risk duplicating data into side tools instead of relying on Lists as the source of truth.

---

## 3. Objectives

| # | Objective | Success Metric |
|---|-----------|----------------|
| O1 | Provide a much better daily UX than native Microsoft Lists | Team prefers Piper for day-to-day task/project work |
| O2 | Keep SharePoint Lists as system of record | All edits sync directly back to Lists |
| O3 | Support multiple schemas via config | New workspace can be mapped without code changes |
| O4 | Support planning views users actually want | List, Kanban, and Gantt are usable daily |
| O5 | Support hierarchy and collaboration | Project hierarchy, optional task hierarchy, and comments are visible in app |

---

## 4. Scope

### In Scope (v1 direction)
- Portable-friendly desktop app for Windows and macOS
- Direct Microsoft login using user accounts
- Shared JSON workspace configs
- Workspace switching
- Configurable field mapping and renderer mapping
- List/table view with inline editing
- Kanban view with drag-and-drop updates
- Gantt/timeline view
- Detail side panel for item editing
- Project and task list support
- Project parent-child support
- Optional task parent-child support when source field exists
- Flat Microsoft List comments
- Saved/shared view presets
- Filtering by any configured field

### Out of Scope (current)
- Replacing SharePoint as source of truth
- Building a separate operational database for domain data
- Offline-first editing
- Arbitrary no-code automation engine
- Heavy admin console beyond workspace configuration
- In-app file/attachment preview beyond opening externally

---

## 5. Users & Personas

### 5.1 Team Lead / Admin
- Configures workspace mappings
- Defines view presets
- Uses Piper for project planning and oversight

### 5.2 Technical Contributor
- Uses Piper daily for assigned tasks
- Needs fast editing, filtering, comments, and planning views

### 5.3 Project Coordinator
- Uses list, Kanban, and Gantt to coordinate timelines and ownership

---

## 6. Functional Requirements

### 6.1 Workspace & Configuration

| ID | Requirement | Priority |
|----|-------------|----------|
| WS1 | Load workspace config from JSON | P0 |
| WS2 | Support stable site/list IDs and human-readable labels | P0 |
| WS3 | Support multiple workspaces in installed mode | P1 |
| WS4 | Support portable distribution with config beside executable | P0 |
| WS5 | Provide config import/export as JSON | P1 |
| WS6 | Provide config setup wizard with preview | P1 |

### 6.2 Data Mapping & Rendering

| ID | Requirement | Priority |
|----|-------------|----------|
| MP1 | Map semantic task/project fields to source columns via config | P0 |
| MP2 | Configure field renderers per field | P0 |
| MP3 | Support person, choice, date, markdown/text, lookup, labels, attachments renderers | P0 |
| MP4 | Support colors for choice/status values | P1 |
| MP5 | Support view-specific field visibility and grouping | P1 |

### 6.3 Core Views

| ID | Requirement | Priority |
|----|-------------|----------|
| CV1 | List/table view with sorting/filtering | P0 |
| CV2 | Inline editing in list view | P0 |
| CV3 | Kanban view with configurable columns and swimlanes | P0 |
| CV4 | Drag-and-drop updates write back immediately | P0 |
| CV5 | Gantt/timeline view for tasks and projects | P1 |
| CV6 | My Tasks view | P1 |
| CV7 | Calendar view | P2 |
| CV8 | Dashboard view | P2 |
| CV9 | Project summary view | P2 |

### 6.4 Detail & Collaboration

| ID | Requirement | Priority |
|----|-------------|----------|
| DC1 | Item detail side panel | P0 |
| DC2 | Rich long-text description rendering/editing | P0 |
| DC3 | Show parent/child relations where configured | P1 |
| DC4 | Show flat Microsoft List comments | P1 |
| DC5 | Open attachments externally | P1 |

### 6.5 Search & Filtering

| ID | Requirement | Priority |
|----|-------------|----------|
| SF1 | Filter by any configured field | P0 |
| SF2 | Saved/shared views with default filters | P0 |
| SF3 | Search by title/metadata | P0 |
| SF4 | Full-text search over long text | P2 |

---

## 7. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| Performance | App should remain responsive for daily use and scale toward thousands of items |
| Sync | User edits should write through immediately to SharePoint Lists |
| Security | Access is based on signed-in Microsoft user permissions |
| Portability | Support portable/shared distribution and installed mode |
| Configurability | Teams can adapt Piper to different list schemas without code changes |
| UX Quality | UI should feel fast, pleasant, and modern enough to displace native list usage |

---

## 8. Data Sources & Integration

### Primary Data Source
- Microsoft Lists / SharePoint Lists inside a single Microsoft 365 tenant

### Auth & Identity
- Microsoft Entra / Microsoft 365 delegated user login

### Configuration Source
- Shared JSON config stored in Teams/OneDrive/SharePoint or imported locally

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| Workspace | A configured Piper connection to one or more SharePoint Lists with mappings and views |
| Mapping | Config that binds Piper semantic fields to actual source columns |
| Renderer | UI treatment for a field, e.g. badge, avatar, markdown, date chip |
| View Preset | Saved list/kanban/gantt/my-tasks configuration with filters and layout |
| Portable Mode | Running Piper from a distributed folder while storing runtime state locally |
