# Piper — Microsoft Graph / SharePoint Integration Specification

> **Phase:** 5 — Real Graph API Integration
> **Status:** Draft
> **Last Updated:** 2026-03-27

---

## 1. Overview

Piper is a Tauri v2 + React desktop application for project and task management backed by Microsoft Lists on SharePoint. The codebase already ships a layered architecture ready for real Graph API integration:

| Layer | Module | Role |
|---|---|---|
| **Config** | `graph-config.ts` | Base URL construction, default scopes, runtime config factory |
| **Types** | `types.ts` | Graph payload interfaces (`GraphListItem`, `GraphListItemComment`, etc.) |
| **Client** | `graph-client.ts` | `GraphClient` interface + `FetchGraphClient` / `MockGraphClient` |
| **Adapter** | `piper-graph-adapter.ts` | Mapping functions: Graph payloads → Piper entities |
| **Repository** | `placeholder-graph-repository.ts` | `PiperRepository` implementation using `GraphClient` |
| **Validation** | `validate-workspace-config.ts` | Verifies field mappings against live column metadata |

Phase 5 replaces placeholder / mock data flows with real Microsoft Graph API calls while preserving this exact layering.

---

## 2. Graph API Endpoints

### 2.1 Endpoint Map

| Operation | Method | Graph v1.0 Path | Piper Method |
|---|---|---|---|
| Get site by ID | `GET` | `/sites/{siteId}` | Site resolution during config validation |
| List list columns | `GET` | `/sites/{siteId}/lists/{listId}/columns` | `GraphClient.listColumns()` |
| List list items | `GET` | `/sites/{siteId}/lists/{listId}/items?$expand=fields` | `GraphClient.listItems()` |
| Get list item | `GET` | `/sites/{siteId}/lists/{listId}/items/{itemId}?$expand=fields` | Fetch single task/project |
| Create list item | `POST` | `/sites/{siteId}/lists/{listId}/items` | `createTask()` |
| Update list item | `PATCH` | `/sites/{siteId}/lists/{listId}/items/{itemId}` | `updateTask()` |
| Delete list item | `DELETE` | `/sites/{siteId}/lists/{listId}/items/{itemId}` | (future) |
| List item comments | `GET` | `/sites/{siteId}/lists/{listId}/items/{itemId}/comments` | `GraphClient.listComments()` |
| Create comment | `POST` | `/sites/{siteId}/lists/{listId}/items/{itemId}/comments` | `createComment()` |

### 2.2 Query Parameters

**List Items** — `$expand`, `$select`, `$top`, `$filter`, `$orderby`:

```
GET /sites/{siteId}/lists/{listId}/items
  ?$expand=fields($select=Title,Status,Priority,Assignee,ProjectLookup)
  &$top=100
  &$filter=fields/Status ne 'Done'
  &$orderby=fields/CreatedDateTime desc
```

The existing `buildGraphListItemsUrl()` helper already constructs `$expand` and `$top`. Phase 5 adds `$filter` and `$orderby` support.

**List Columns** — `$select` to limit metadata:

```
GET /sites/{siteId}/lists/{listId}/columns?$select=name,displayName,textColumn,choiceColumn
```

### 2.3 Request / Response Shapes

All shapes are already defined in `src/lib/graph/types.ts`. The key types:

```typescript
// Collection envelope (supports pagination via nextLink)
interface GraphCollectionResponse<TValue> {
  value: TValue[]
  nextLink?: string    // @odata.nextLink from Graph
}

// A SharePoint list item with field values
interface GraphListItem {
  id: string
  etag?: string        // Required for optimistic concurrency
  createdDateTime: string
  lastModifiedDateTime: string
  createdBy: GraphIdentitySet
  lastModifiedBy: GraphIdentitySet
  fields: GraphListItemFields  // Dynamic field bag
}

// A comment on a list item
interface GraphListItemComment {
  id: string
  content: string
  contentType: "text" | "html"
  createdDateTime: string
  lastModifiedDateTime?: string
  createdBy: GraphIdentitySet
  mentions?: GraphListItemCommentMention[]
}
```

---

## 3. Authentication via MSAL

### 3.1 Architecture

Piper runs as a native Tauri application. Authentication uses the **Microsoft Authentication Library (MSAL)** with the **Authorization Code Flow with PKCE**, which is the recommended flow for desktop / native apps.

```
┌─────────────┐      ┌───────────────┐      ┌──────────────────┐
│  Piper UI   │─────▶│  MSAL Broker  │─────▶│  Azure AD /      │
│  (React)    │◀─────│  (Tauri Rust) │◀─────│  Entra ID        │
└─────────────┘      └───────────────┘      └──────────────────┘
        │                    │
        ▼                    ▼
  AccessTokenProvider   Token Cache
  (callback to Rust)    (encrypted, OS keychain)
```

### 3.2 Required Scopes

```typescript
const defaultMicrosoftGraphScopes = [
  "User.Read",        // Read signed-in user profile
  "Sites.Read.All",   // Read site and list structure
  "Lists.ReadWrite",  // Read and write list items + comments
] as const
```

These are already declared in `graph-config.ts`. If write operations on comments require `Sites.ReadWrite.All`, the scope list should be extended.

### 3.3 Token Lifecycle

| Event | Action |
|---|---|
| **App launch** | Attempt silent token acquisition from cache. If expired, use refresh token. |
| **Token expired (401)** | MSAL acquires a new token silently. Retry the failed request once. |
| **Interaction required** | Open the system browser for interactive login. MSAL listens on the redirect URI. |
| **Token refresh failure** | Prompt user to re-authenticate. Surface error in UI. |

### 3.4 Integration with GraphClient

The existing `GraphClient` accepts an `accessTokenProvider` callback:

```typescript
interface MicrosoftGraphRuntimeConfig {
  baseUrl?: string
  scopes?: string[]
  accessTokenProvider?: () => Promise<string>
  fetch?: typeof fetch
}
```

The Tauri backend exposes an `invoke("graph:get_access_token")` command. The frontend wires it as:

```typescript
const graphClient = new FetchGraphClient({
  accessTokenProvider: () => invoke<string>("graph:get_access_token"),
})
```

This keeps the `GraphClient` free of MSAL internals and testable with a simple stub.

---

## 4. Data Mapping Strategy

### 4.1 Config-Driven Field Resolution

Piper never hard-codes SharePoint column names. Instead, a `WorkspaceConfig` declares the mapping between semantic field names and SharePoint source columns:

```typescript
// Example workspace config (excerpt)
{
  lists: {
    tasks: {
      site: { id: "contoso.sharepoint.com,site-id", label: "Engineering" },
      list: { id: "task-list-guid", label: "Tasks" },
      fields: {
        title:     { sourceField: "Title",       dataType: "string" },
        status:    { sourceField: "TaskStatus",   dataType: "choice" },
        priority:  { sourceField: "Priority",     dataType: "choice" },
        assignee:  { sourceField: "AssignedTo",   dataType: "person" },
        projectRef:{ sourceField: "ProjectLookup",dataType: "lookup" },
      },
    },
  },
}
```

The adapter reads `sourceField` from config, fetches `item.fields[sourceField]`, and normalizes the raw Graph value.

### 4.2 Mapping Functions

All mapping logic lives in `piper-graph-adapter.ts`. The core functions:

| Function | Input | Output | Notes |
|---|---|---|---|
| `mapGraphListItemToWorkspaceTask` | `GraphListItem` + config | `WorkspaceTask` | Normalizes status, priority, person fields, lookups, JSON fields (checklist, attachments) |
| `mapGraphListItemToWorkspaceProject` | `GraphListItem` + config | `WorkspaceProject` | Same pattern with project-specific fields (health, milestones) |
| `mapGraphListCommentToCommentRef` | `GraphListItemComment` + context | `CommentRef` | Maps identity sets, mentions, HTML/text body |
| `attachCommentsToTasks` | Tasks + Comments | Hydrated tasks | Groups comments by entity ID |
| `applyProjectTaskAggregates` | Projects + Tasks | Projects with counts | Computes taskCount, openTaskCount |
| `collectPeopleFromGraphEntities` | Projects + Tasks + Comments | `PersonRef[]` | Deduplicates people by ID |

### 4.3 Field Value Normalization

Raw SharePoint field values are messy. The adapter handles each case:

| Graph Value Type | Normalizer | Piper Type |
|---|---|---|
| `string` | `asPrimitiveString()` | `string \| undefined` |
| `number` / `"42"` | `asPrimitiveNumber()` | `number \| undefined` |
| Person object (`{ Email, DisplayName, LookupId }`) | `mapGraphPersonValue()` | `PersonRef \| undefined` |
| Person array | `mapGraphPersonArray()` | `PersonRef[]` |
| Lookup (`{ LookupId, LookupValue }`) | `mapLookupId()` | Entity ID string (`scope:listId:lookupId`) |
| Choice string (`"In Progress"`) | `normalizeTaskStatus()` | Enum value (`"in-progress"`) |
| JSON string (`"[{\"checked\":true}]"`) | `parseJsonArray()` | Typed array |
| Path string (`"Parent > Child"`) | `parsePath()` | `string[]` |
| Tag string (`"bug;ui;critical"`) | `asStringArray()` | `string[]` |

### 4.4 Entity ID Scheme

Piper generates stable, deterministic entity IDs from the Graph item coordinates:

```typescript
function createEntityId(scope: "projects" | "tasks", listId: string, itemId: string): string {
  return `${scope}:${listId}:${itemId}`
}
// Example: "tasks:a1b2c3:42"
```

This scheme ensures the same SharePoint item always maps to the same Piper ID, enabling cache consistency and deduplication.

---

## 5. CRUD Operations

### 5.1 List Items (Read)

```typescript
async listItems(request: GraphListItemsRequest): Promise<GraphCollectionResponse<GraphListItem>> {
  const url = buildGraphListItemsUrl(this.runtimeConfig.baseUrl, request)
  const response = await fetch(url, { headers: await this.createHeaders() })
  return parseGraphResponse(response)
}
```

Request options:
- `selectFields` — limits `$expand=fields($select=...)` for performance
- `top` — page size (default 100, max 200 per Graph limits)
- `filter` — OData filter expression (e.g., `fields/Status ne 'Done'`)

### 5.2 Create Task

The current `PlaceholderGraphRepository.createTask()` stores overrides locally. The real implementation will `POST` to Graph:

```
POST /sites/{siteId}/lists/{listId}/items
Content-Type: application/json

{
  "fields": {
    "Title": "New task title",
    "TaskStatus": "Not Started",
    "Priority": "Medium",
    "ProjectLookup": { "LookupId": 12 },
    "AssignedTo": "user@contoso.com"
  }
}
```

Implementation outline:

```typescript
async createTask(input: CreateTaskInput): Promise<WorkspaceTask> {
  const config = this.getWorkspaceConfig(input.workspaceId)
  const taskList = config.lists.tasks
  const fields: Record<string, unknown> = {}

  // Map semantic fields to source columns
  fields[taskList.fields.title.sourceField] = input.title
  if (input.status) {
    fields[taskList.fields.status.sourceField] = graphStatusValue(input.status)
  }
  if (input.priority) {
    fields[taskList.fields.priority.sourceField] = graphPriorityValue(input.priority)
  }
  if (input.projectId) {
    // Extract lookup ID from entity ID: "projects:listId:itemId"
    const itemId = input.projectId.split(":")[2]
    fields[taskList.fields.projectRef.sourceField] = { LookupId: Number(itemId) }
  }

  const graphItem = await this.graphClient.createItem({
    siteId: taskList.site.id,
    listId: taskList.list.id,
    fields,
  })

  return mapGraphListItemToWorkspaceTask({ workspaceConfig: config, item: graphItem })
}
```

**New `GraphClient` method required:**

```typescript
createItem(request: {
  siteId: string
  listId: string
  fields: Record<string, unknown>
}): Promise<GraphListItem>
```

### 5.3 Update Task

```
PATCH /sites/{siteId}/lists/{listId}/items/{itemId}
Content-Type: application/json
If-Match: {etag}

{
  "fields": {
    "TaskStatus": "In Progress",
    "Priority": "High"
  }
}
```

The `If-Match` header uses the item's `etag` for optimistic concurrency. If the item was modified server-side since the last read, Graph returns `412 Precondition Failed`.

**New `GraphClient` method required:**

```typescript
updateItem(request: {
  siteId: string
  listId: string
  itemId: string
  etag?: string
  fields: Record<string, unknown>
}): Promise<GraphListItem>
```

### 5.4 Create Comment

```
POST /sites/{siteId}/lists/{listId}/items/{itemId}/comments
Content-Type: application/json

{
  "content": "This looks good, shipping it.",
  "contentType": "text"
}
```

**New `GraphClient` method required:**

```typescript
createComment(request: {
  siteId: string
  listId: string
  itemId: string
  content: string
  contentType?: "text" | "html"
}): Promise<GraphListItemComment>
```

### 5.5 Full Extended GraphClient Interface

Phase 5 expands the `GraphClient` interface to support write operations:

```typescript
export interface GraphClient {
  // Existing (read-only)
  getListMetadata(reference: GraphListReference): Promise<GraphListMetadata>
  listColumns(request: GraphListColumnsRequest): Promise<GraphCollectionResponse<GraphListColumnDefinition>>
  listItems(request: GraphListItemsRequest): Promise<GraphCollectionResponse<GraphListItem>>
  listComments(request: GraphListItemCommentsRequest): Promise<GraphCollectionResponse<GraphListItemComment>>

  // New (write operations)
  createItem(request: GraphCreateItemRequest): Promise<GraphListItem>
  updateItem(request: GraphUpdateItemRequest): Promise<GraphListItem>
  createComment(request: GraphCreateCommentRequest): Promise<GraphListItemComment>
}
```

---

## 6. Error Handling

### 6.1 Error Categories

| Category | HTTP Status | Response | Recovery |
|---|---|---|---|
| **Auth failure** | `401 Unauthorized` | `InvalidAuthenticationToken` | Refresh token via MSAL; retry once |
| **Rate limiting** | `429 Too Many Requests` | `Retry-After` header | Exponential backoff; respect `Retry-After` |
| **Throttling** | `503 Service Unavailable` | `Retry-After` header | Backoff with jitter |
| **Conflict** | `412 Precondition Failed` | — | Re-fetch item, merge or prompt user |
| **Not found** | `404 Not Found` | — | Surface as stale-data warning |
| **Validation** | `400 Bad Request` | Field-level error details | Surface validation errors in UI |
| **Server error** | `500 / 502 / 504` | — | Retry up to 3 times with backoff |
| **Network error** | N/A (fetch throws) | — | Queue operation offline; retry when connected |

### 6.2 Retry Strategy

```typescript
interface RetryPolicy {
  maxRetries: number         // Default: 3
  baseDelayMs: number        // Default: 1000
  maxDelayMs: number         // Default: 30000
  retryableStatuses: number[] // [401, 429, 500, 502, 503, 504]
}
```

Implementation:

```typescript
async function graphFetchWithRetry(
  url: string,
  options: RequestInit,
  policy: RetryPolicy = defaultRetryPolicy,
  attempt = 0,
): Promise<Response> {
  const response = await fetch(url, options)

  if (response.ok || !policy.retryableStatuses.includes(response.status)) {
    return response
  }

  if (attempt >= policy.maxRetries) {
    throw new GraphApiError(response.status, await response.text())
  }

  // Respect Retry-After header for 429 / 503
  const retryAfter = response.headers.get("Retry-After")
  const delay = retryAfter
    ? Number(retryAfter) * 1000
    : Math.min(policy.baseDelayMs * 2 ** attempt + jitter(), policy.maxDelayMs)

  await sleep(delay)

  // For 401, attempt token refresh before retrying
  if (response.status === 401) {
    await refreshAccessToken()
    options.headers = await createAuthHeaders()
  }

  return graphFetchWithRetry(url, options, policy, attempt + 1)
}
```

### 6.3 Conflict Recovery (ETag)

When a `PATCH` returns `412 Precondition Failed`:

1. Re-fetch the current item state with `GET`.
2. Compare server version with the local attempted patch.
3. If fields are non-conflicting, apply patch to fresh data and retry.
4. If fields conflict, surface a merge prompt to the user.

### 6.4 Offline Resilience

Piper should detect network unavailability and:

- Queue write operations (create task, update task, create comment) in a local operation log.
- Replay queued operations when connectivity is restored, in order.
- Surface a visual indicator ("Offline — changes will sync when connected").

---

## 7. Pagination

### 7.1 Graph Pagination Model

Graph returns collections with an `@odata.nextLink` URL when more pages are available:

```json
{
  "value": [ ... ],
  "@odata.nextLink": "https://graph.microsoft.com/v1.0/sites/.../items?$top=100&$skiptoken=abc123"
}
```

The existing `GraphCollectionResponse<T>` type already includes `nextLink`:

```typescript
interface GraphCollectionResponse<TValue> {
  value: TValue[]
  nextLink?: string  // @odata.nextLink
}
```

### 7.2 Pagination Implementation

The `FetchGraphClient` currently returns only the first page. Phase 5 adds a `fetchAllPages` utility:

```typescript
async function fetchAllPages<TValue>(
  fetchPage: (url: string) => Promise<GraphCollectionResponse<TValue>>,
  initialUrl: string,
  maxPages = 50,     // Safety limit
  maxItems = 10000,  // Safety limit
): Promise<TValue[]> {
  const allItems: TValue[] = []
  let url: string | undefined = initialUrl
  let pages = 0

  while (url && pages < maxPages && allItems.length < maxItems) {
    const response = await fetchPage(url)
    allItems.push(...response.value)
    url = response.nextLink
    pages++
  }

  return allItems
}
```

### 7.3 Page Size Guidance

| Scenario | `$top` Value | Rationale |
|---|---|---|
| Task list (< 500 items) | `100` | Default; balances latency vs. round trips |
| Large task list (500+) | `200` | Graph maximum for `$top` |
| Column metadata | Omit | Usually < 50 columns, single page |
| Comments per item | `50` | Most items have few comments |
| Full sync / initial load | `200` | Minimize round trips |

### 7.4 Incremental Sync (Future)

For ongoing sync after initial load, use `$filter` with a `lastModifiedDateTime` watermark:

```
GET /sites/{siteId}/lists/{listId}/items
  ?$expand=fields
  &$filter=fields/LastModifiedDateTime gt 2026-03-27T12:00:00Z
  &$orderby=fields/LastModifiedDateTime asc
  &$top=200
```

This avoids re-fetching the entire dataset on each refresh.

---

## 8. Testing Approach

### 8.1 MockGraphClient

The codebase already includes `MockGraphClient` in `graph-client.ts`. It returns canned data keyed by list reference and is suitable for:

- Unit tests of the adapter mapping functions
- Repository-level tests without network access
- Component rendering tests with predictable data

**Usage pattern:**

```typescript
import { MockGraphClient, mockGraphClient } from "@/lib/graph/graph-client"

// Use the default singleton
const repo = new GraphBackedRepository({
  graphClient: mockGraphClient,
  workspaceConfigs: [testWorkspaceConfig],
})

// Or create a custom MockGraphClient with overridden data
const customClient = new MockGraphClient()
```

### 8.2 Test Matrix

| Layer | Test Type | Tool | Scope |
|---|---|---|---|
| **Types** | Compile-time | TypeScript | Ensure payload shapes match Graph docs |
| **URL builders** | Unit | Vitest | `buildGraphListItemsUrl`, `buildGraphListCommentsUrl`, `buildGraphListColumnsUrl` |
| **Adapter mappers** | Unit | Vitest | Every `mapGraph*` function with edge cases |
| **Normalization** | Unit | Vitest | Status, priority, person, lookup, JSON, path, tags |
| **GraphClient** | Unit | Vitest + MockGraphClient | Read operations return correct shapes |
| **Repository** | Integration | Vitest + MockGraphClient | End-to-end: listTasks, createTask, updateTask, comments |
| **Config validation** | Unit | Vitest + MockGraphClient | `validateWorkspaceConfigAgainstGraph()` detects missing columns |
| **Retry logic** | Unit | Vitest + mocked fetch | 429 → backoff, 401 → token refresh, 412 → conflict |
| **Pagination** | Unit | Vitest | `fetchAllPages` handles nextLink chains and limits |
| **E2E** | Manual | Playwright (future) | Full flow: auth → load workspace → create task → add comment |

### 8.3 Adapter Mapper Tests (Example)

```typescript
import { describe, it, expect } from "vitest"
import { mapGraphListItemToWorkspaceTask } from "@/lib/graph/piper-graph-adapter"

describe("mapGraphListItemToWorkspaceTask", () => {
  it("maps a GraphListItem to a WorkspaceTask with config-driven fields", () => {
    const item: GraphListItem = {
      id: "42",
      etag: '"etag-value"',
      createdDateTime: "2026-01-15T10:00:00Z",
      lastModifiedDateTime: "2026-03-20T14:30:00Z",
      createdBy: { user: { id: "user-1", displayName: "Ada Lovelace", email: "ada@contoso.com" } },
      lastModifiedBy: { user: { id: "user-1", displayName: "Ada Lovelace", email: "ada@contoso.com" } },
      fields: {
        Title: "Implement Graph pagination",
        TaskStatus: "In Progress",
        Priority: "High",
        AssignedTo: { Email: "ada@contoso.com", DisplayName: "Ada Lovelace", LookupId: 1 },
        ChecklistData: '[{"id":"c1","label":"Design","checked":true}]',
      },
    }

    const task = mapGraphListItemToWorkspaceTask({ workspaceConfig: testConfig, item })

    expect(task.title).toBe("Implement Graph pagination")
    expect(task.status).toBe("in-progress")
    expect(task.priority).toBe("high")
    expect(task.assignee?.email).toBe("ada@contoso.com")
    expect(task.checklist).toEqual([{ id: "c1", label: "Design", checked: true }])
  })

  it("falls back gracefully when optional fields are missing", () => {
    const task = mapGraphListItemToWorkspaceTask({
      workspaceConfig: minimalConfig,
      item: { /* minimal item with only required fields */ },
    })

    expect(task.title).toBe("Untitled task")
    expect(task.status).toBe("backlog")
    expect(task.assignee).toBeUndefined()
    expect(task.checklist).toEqual([])
  })
})
```

### 8.4 Repository Tests (Example)

```typescript
describe("GraphBackedRepository", () => {
  let repo: PiperRepository
  let graphClient: MockGraphClient

  beforeEach(() => {
    graphClient = new MockGraphClient()
    repo = new GraphBackedRepository({
      graphClient,
      workspaceConfigs: [mockGraphWorkspaceBindings[0].config],
    })
  })

  it("lists tasks for a workspace", async () => {
    const tasks = await repo.listWorkspaceTasks({
      workspaceId: "test-workspace",
      includeCompleted: false,
    })
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks[0]).toHaveProperty("id")
    expect(tasks[0]).toHaveProperty("title")
  })

  it("creates a task via GraphClient.createItem", async () => {
    const task = await repo.createTask({
      workspaceId: "test-workspace",
      title: "New task",
      status: "backlog",
      priority: "medium",
    })
    expect(task.title).toBe("New task")
    expect(task.id).toBeDefined()
  })

  it("updates a task via GraphClient.updateItem with etag", async () => {
    const updated = await repo.updateTask({
      workspaceId: "test-workspace",
      taskId: "tasks:test-list:1",
      patch: { status: "in-progress" },
    })
    expect(updated.status).toBe("in-progress")
  })
})
```

---

## 9. Implementation Checklist

### Phase 5a — Core Read Path

- [ ] Extend `FetchGraphClient` with retry logic and `Retry-After` handling
- [ ] Implement `fetchAllPages` pagination utility
- [ ] Wire MSAL token provider from Tauri commands to `FetchGraphClient`
- [ ] Replace `PlaceholderGraphRepository` with `GraphBackedRepository` (same `PiperRepository` interface)
- [ ] Verify `validateWorkspaceConfigAgainstGraph` works against live Graph

### Phase 5b — Write Operations

- [ ] Add `createItem`, `updateItem`, `createComment` to `GraphClient` interface
- [ ] Implement write methods in `FetchGraphClient` with `If-Match` / etag support
- [ ] Implement `createTask`, `updateTask`, `createComment` in `GraphBackedRepository`
- [ ] Add reverse-mapping helpers (Piper enum → Graph choice value)

### Phase 5c — Resilience

- [ ] Implement offline operation queue
- [ ] Add conflict recovery for `412 Precondition Failed`
- [ ] Add incremental sync with `lastModifiedDateTime` watermark
- [ ] Add UI indicators for loading, offline, and sync states

### Phase 5d — Testing & Polish

- [ ] Extend `MockGraphClient` with write-method stubs
- [ ] Unit tests for all new `GraphClient` methods
- [ ] Integration tests for repository write flows
- [ ] Error scenario tests (401, 429, 412, network failure)
- [ ] Paginated response tests

---

## 10. Key Design Decisions

| Decision | Rationale |
|---|---|
| **Config-driven field mapping** | SharePoint column names vary per tenant. The `WorkspaceConfig` schema decouples Piper from specific column names. |
| **`GraphClient` as an interface** | Enables `MockGraphClient` for testing and allows future backends (e.g., a local SQLite cache). |
| **Deterministic entity IDs** | `scope:listId:itemId` is stable across sessions, enabling caching and deduplication without a separate ID map. |
| **ETag-based concurrency** | SharePoint provides `etag` on every item. Using `If-Match` prevents silent overwrites. |
| **Adapter functions, not classes** | Pure functions (`mapGraphListItemToWorkspaceTask`) are easy to test in isolation with no mocking needed. |
| **`accessTokenProvider` as a callback** | Decouples `FetchGraphClient` from MSAL. The token acquisition strategy (silent, interactive, cached) lives outside the client. |
| **Pagination as a utility** | `fetchAllPages` is a standalone function, not mixed into `GraphClient`. This keeps the client thin and the pagination logic independently testable. |
