# NEV-14: MS Lists CRUD Operations — Implementation Specification

**Status:** In Progress
**Priority:** Critical
**Owner:** Synthia (Product Architect)
**Depends on:** NEV-13 (OAuth2 auth — in progress), NEV-5 (integration slice — done), NEV-24 (IssueStore interface — done)

---

## 1. Objective

Implement create, read, update, and delete operations for SharePoint list items
so Piper can manage Microsoft Lists data as native issues.

## 2. Current State (Gap Analysis)

### What exists:
- `IssueStore` interface (NEV-24 ✓) with full CRUD + sync contract
- `MsListsIssueStore` class implementing `IssueStore`
- `MsListsSchemaMapper` implementing `SchemaMapper<GraphListItem>`
- `GraphClient` interface + `FetchGraphClient` + `MockGraphClient`
- `BackendRegistry`, `IssueStoreRepository` bridge
- `AuthProvider` interface + `NoopAuthProvider`
- Graph adapter functions for mapping items/comments/people

### Critical gaps:

#### Gap 1: GraphClient lacks write operations
The `GraphClient` interface only has read methods:
- `getListMetadata()`
- `listColumns()`
- `listItems()`
- `listComments()`

Missing:
- `createItem()` — POST new list items
- `updateItemFields()` — PATCH item fields
- `deleteItem()` — DELETE items
- `createComment()` — POST comments
- `getItem()` — GET single item (for re-fetch after create/update)

#### Gap 2: MsListsIssueStore uses bare `fetch()` for writes
The `graphRead()` and `graphWrite()` private methods (lines 533-571) call
`fetch()` directly, bypassing the `GraphClient`'s token management entirely.
This means writes will always fail in production — no auth headers.

#### Gap 3: No list discovery
The spec requires "enumerate SharePoint sites and lists". There is no
`listSites()` or `listLists()` method on `GraphClient` or anywhere else.

#### Gap 4: No pagination for large lists
`listItems()` returns a `GraphCollectionResponse<T>` with an optional
`nextLink` field, but neither `FetchGraphClient` nor `MsListsIssueStore`
follows `@odata.nextLink` for paginated results. Lists with > 200 items
(Graph default page size) will silently truncate.

#### Gap 5: No retry logic
No automatic retry on transient Graph API errors (429 Too Many Requests,
503 Service Unavailable, network timeouts).

#### Gap 6: Error handling surfaces raw errors
Graph API errors are thrown as raw `Error` objects. No structured error
types for the UI to display user-friendly messages.

## 3. Implementation Plan

### 3.1 Extend GraphClient Interface

Add write operations and discovery methods:

```typescript
interface GraphClient {
  // Existing reads...
  getListMetadata(reference: GraphListReference): Promise<GraphListMetadata>;
  listColumns(request: GraphListColumnsRequest): Promise<GraphCollectionResponse<GraphListColumnDefinition>>;
  listItems(request: GraphListItemsRequest): Promise<GraphCollectionResponse<GraphListItem>>;
  listComments(request: GraphListItemCommentsRequest): Promise<GraphCollectionResponse<GraphListItemComment>>;

  // NEW: Single item read
  getItem(request: GraphGetItemRequest): Promise<GraphListItem>;

  // NEW: Write operations
  createItem(request: GraphCreateItemRequest): Promise<GraphListItem>;
  updateItemFields(request: GraphUpdateItemFieldsRequest): Promise<GraphListItem>;
  deleteItem(request: GraphDeleteItemRequest): Promise<void>;
  createComment(request: GraphCreateCommentRequest): Promise<GraphListItemComment>;

  // NEW: Discovery
  listSites(query?: string): Promise<GraphCollectionResponse<GraphSite>>;
  listSiteLists(siteId: string): Promise<GraphCollectionResponse<GraphListInfo>>;

  // NEW: Pagination helper
  listAllItems(request: GraphListItemsRequest): Promise<GraphListItem[]>;
}
```

### 3.2 Fix MsListsIssueStore Auth Bypass

Replace private `graphRead()`/`graphWrite()` methods with calls to
`GraphClient` methods. All HTTP traffic goes through `GraphClient` which
manages auth tokens via `MicrosoftGraphRuntimeConfig.accessTokenProvider`.

### 3.3 Add Pagination

Implement `@odata.nextLink` following in `FetchGraphClient.listItems()`.
Add a `listAllItems()` convenience method that auto-paginates.
`MsListsIssueStore.refreshAll()` should use `listAllItems()`.

### 3.4 Add Retry Logic

Add a `withRetry()` wrapper in `FetchGraphClient` for:
- HTTP 429 (respect `Retry-After` header)
- HTTP 503/504 (exponential backoff)
- Network errors (exponential backoff, max 3 retries)

### 3.5 Structured Error Types

```typescript
class GraphApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly graphErrorCode: string,
    public readonly requestId?: string,
  ) { super(message); }
}
```

### 3.6 List Discovery

New `GraphSite` and `GraphListInfo` types for discovery.
New UI component or hook not in scope for NEV-14 (that's UI work),
but the GraphClient methods must be ready.

## 4. Acceptance Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| 1 | Piper can list all available SharePoint lists for a site | `GraphClient.listSiteLists()` returns lists |
| 2 | Piper can read items from a list and display them as issues | `MsListsIssueStore.listTasks()` works end-to-end |
| 3 | Piper can create list items | `MsListsIssueStore.createTask()` uses `GraphClient.createItem()` |
| 4 | Piper can edit list items | `MsListsIssueStore.updateTask()` uses `GraphClient.updateItemFields()` |
| 5 | Piper can delete list items | `MsListsIssueStore.deleteTask()` uses `GraphClient.deleteItem()` |
| 6 | All writes use authenticated GraphClient | No bare `fetch()` in MsListsIssueStore |
| 7 | Column types handled: text, choice, date, person, number, boolean | Schema mapper handles all types |
| 8 | Pagination works for lists > 200 items | `listAllItems()` follows nextLink |
| 9 | Transient errors are retried | 429/503 get automatic retry |
| 10 | Errors surface user-friendly messages | `GraphApiError` has structured codes |

## 5. Files Changed

| File | Change |
|------|--------|
| `src/lib/graph/graph-client.ts` | Extend interface + FetchGraphClient + MockGraphClient |
| `src/lib/graph/types.ts` | New request/response types for write ops + discovery |
| `src/lib/graph/graph-config.ts` | URL builders for write endpoints + discovery |
| `src/lib/graph/graph-errors.ts` | **NEW** — GraphApiError, retry logic |
| `src/lib/store/ms-lists/ms-lists-issue-store.ts` | Replace graphRead/graphWrite with GraphClient calls |
| `src/lib/store/ms-lists/__tests__/ms-lists-issue-store.test.ts` | Update tests for new GraphClient methods |

## 6. Dependency Note

NEV-13 (OAuth2) provides the `accessTokenProvider` callback. The CRUD
implementation works end-to-end with `MockGraphClient` today. When NEV-13
lands, `FetchGraphClient` will pick up real tokens automatically — no
additional integration work needed in NEV-14 code.

## 7. Out of Scope

- OAuth2 authentication flow (NEV-13)
- UI for list discovery / workspace setup (separate issue)
- Bidirectional sync engine (NEV-16)
- Schema mapping engine (NEV-15 — blocked on this)
