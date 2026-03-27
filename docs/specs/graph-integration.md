# Piper — Microsoft Graph Integration Boundary

## Purpose

This document defines the phase 1 integration boundary between Piper's semantic repository layer and Microsoft Graph / SharePoint Lists.

The goal is to keep Graph-specific payload handling out of React views while making the future delegated-auth implementation straightforward.

## Design Goals

- Keep SharePoint Lists and Microsoft Lists as the source of truth.
- Treat Microsoft Graph payloads as raw boundary objects only.
- Convert Graph list items, people, lookups, and comments into Piper-native entities before data reaches hooks or views.
- Make it possible to run realistic local development without live tenant access.
- Structure the client so delegated auth and real `fetch` calls can be wired in later without refactoring the UI.

## Files

- `src/lib/graph/types.ts`
- `src/lib/graph/graph-config.ts`
- `src/lib/graph/graph-client.ts`
- `src/lib/graph/mock-graph-payloads.ts`
- `src/lib/graph/piper-graph-adapter.ts`
- `src/lib/graph/placeholder-graph-repository.ts`

## Boundary Layers

```text
React views / hooks
  -> PiperRepository
    -> PlaceholderGraphRepository
      -> GraphClient
        -> Microsoft Graph list item + comment payloads
      -> PiperGraphAdapter mapping helpers
        -> WorkspaceTask / WorkspaceProject / CommentRef / PersonRef / PiperWorkspace
```

Views and feature hooks should only consume `PiperRepository` results. They should never parse Graph field bags or inspect Graph comments directly.

## Raw Graph Shapes Modeled

The boundary types intentionally model realistic Microsoft Graph / SharePoint List behavior:

### List items

`GraphListItem` includes:
- `id`
- `fields` bag
- `createdDateTime`
- `lastModifiedDateTime`
- `createdBy`
- `lastModifiedBy`
- `sharepointIds`
- `webUrl`
- optional `etag`

### Field bag values

`GraphListFieldValue` supports:
- primitive values: string, number, boolean, null
- primitive arrays
- person-like values with `LookupId`, `LookupValue`, `Email`, `DisplayName`, `Claims`, `Department`, `JobTitle`
- lookup-like values with `LookupId` and `LookupValue`
- arrays of person-like and lookup-like values

This matches how SharePoint-backed Graph payloads often expose expanded field bags after `?$expand=fields(...)`.

### Identity metadata

`GraphIdentitySet` and `GraphIdentity` represent Graph-style `createdBy` / `lastModifiedBy` identity payloads and are mapped into Piper `PersonRef` values.

### Flat comments

`GraphListItemComment` models list-item comments as a flat collection with:
- `id`
- `createdDateTime`
- `lastModifiedDateTime`
- `content`
- `contentType`
- `createdBy`
- `mentions`

Piper currently treats list comments as flat item-scoped comments, which matches the current product direction and known Graph limitations.

## Mapping Strategy

`src/lib/graph/piper-graph-adapter.ts` owns all Graph-to-Piper mapping helpers.

Key responsibilities:
- read workspace-config field bindings
- normalize choice labels into Piper enums
- turn SharePoint people fields into `PersonRef`
- turn lookup fields into Piper entity references
- map Graph comments into `CommentRef`
- attach comments to tasks
- compute project aggregates from task data
- build `PiperWorkspace` summary metadata from fetched Graph-backed entities

### Semantic IDs

Piper semantic IDs are derived from Graph list scope + list ID + list item ID:

```text
projects:{listId}:{itemId}
tasks:{listId}:{itemId}
comment:{listId}:{itemId}:{commentId}
```

This keeps the UI and repository layers decoupled from raw Graph response objects while preserving a deterministic link back to the source system.

## Repository Contract

`PlaceholderGraphRepository` implements `PiperRepository` directly.

That means the rest of the app can swap between:
- `MockPiperRepository` for local semantic fixtures
- `PlaceholderGraphRepository` for Graph-shaped development and future live Graph access

without changing hooks or view components.

### Current behavior

The placeholder repository:
- loads workspace definitions from checked-in workspace config
- fetches project/task list items through `GraphClient`
- fetches item comments per task/project
- maps all Graph payloads to Piper semantic entities
- returns `PiperWorkspace`, `WorkspaceProject`, `WorkspaceTask`, `CommentRef`, and `PersonRef`

## Realistic Mock Payloads

`src/lib/graph/mock-graph-payloads.ts` synthesizes Graph-like list item and comment payloads from the existing semantic fixtures.

The mock data includes:
- numeric SharePoint-style list item IDs
- field bags using configured internal field names like `TaskStatus`, `AssignedTo`, `ProjectOwner`, `ParentProject`
- person-like field payloads
- lookup-like field payloads
- item metadata like `sharepointIds`, `webUrl`, and `etag`
- per-item flat comment collections with identity/mention metadata

This is realistic enough for adapter development, query work, and repository wiring before authentication is connected.

## Auth and Real Fetch Readiness

`src/lib/graph/graph-client.ts` contains two implementations:
- `MockGraphClient`
- `FetchGraphClient`

`FetchGraphClient` is already structured for future delegated auth:
- receives an access-token provider
- builds Graph URLs centrally via `graph-config.ts`
- uses real `fetch`
- adds `Authorization: Bearer <token>` when a token provider is available

The missing step for live Graph integration is wiring an MSAL or equivalent delegated-auth flow that supplies the token provider.

## Known Gaps

These are intentionally left for later implementation work:
- actual delegated Microsoft sign-in and token refresh
- write/update calls for list items and comments
- attachment upload/download handling
- schema discovery for arbitrary list fields
- pagination and delta sync
- robust filtering passed through to Graph instead of client-side filtering

## Recommended Next Steps

1. Add delegated auth runtime using MSAL or a Tauri-friendly OAuth flow.
2. Replace mock Graph client injection with `FetchGraphClient` in a controlled app bootstrap path.
3. Add update methods for list items and comments.
4. Add list metadata/schema discovery to validate workspace config against live lists.
5. Add integration tests around Graph payload mapping edge cases.
