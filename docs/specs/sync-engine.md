# Piper — Bidirectional Sync Engine Specification (M4)

> **Issue:** NEV-16
> **Author:** Synthia (Product Architect)
> **Date:** 2026-03-29
> **Status:** Draft — Ready for Engineering Review
> **Dependency:** M3 (NEV-81, Schema Mapping Engine)

---

## 1. Product Vision

The sync engine is the heart of Piper's value proposition: **users never have to think about whether their changes are reflected in SharePoint**. Edits flow in both directions seamlessly, conflicts are surfaced clearly, and sync status is always visible.

### 1.1 Design Principles

1. **Write-through by default.** Edits in Piper go to MS Lists immediately. Piper is a lens, not a database.
2. **Pull is incremental.** After initial load, only changed items are fetched. No full re-fetch on every refresh.
3. **Conflicts are rare but handled gracefully.** When two users edit the same field simultaneously, the user gets a clear resolution prompt — never silent data loss.
4. **Status is always visible.** Users always know if they're looking at fresh data or stale cache.
5. **Offline is a first-class state.** Piper works offline; changes queue and replay when connected.

---

## 2. Sync Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Piper UI (React)                                               │
│  ┌──────────┐  ┌───────────┐  ┌────────────────┐               │
│  │ Views    │  │ Detail    │  │ Sync Status    │               │
│  │ (List,   │  │ Panel     │  │ Indicator      │               │
│  │  Kanban) │  │           │  │ (topbar)       │               │
│  └────┬─────┘  └─────┬─────┘  └───────┬────────┘               │
│       │              │                │                         │
│       ▼              ▼                ▼                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Sync Orchestrator (TypeScript)                           │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ Change      │  │ Conflict     │  │ Operation      │  │   │
│  │  │ Tracker     │  │ Resolver     │  │ Queue          │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ Pull Sync   │  │ Push Sync    │  │ Sync State     │  │   │
│  │  │ (delta)     │  │ (write-thru) │  │ Store          │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────▼──────────────────────────────┐   │
│  │ PiperRepository (existing interface)                      │   │
│  │ - listWorkspaceTasks, updateTask, createTask, etc.        │   │
│  └───────────────────────────┬──────────────────────────────┘   │
│                              │                                   │
│  ┌───────────────────────────▼──────────────────────────────┐   │
│  │ GraphClient (existing interface)                          │   │
│  │ - listItems, createItem, updateItem, listComments         │   │
│  └───────────────────────────┬──────────────────────────────┘   │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
              Microsoft Graph API (SharePoint Lists)
```

---

## 3. Sync Lifecycle

### 3.1 Initial Load (Cold Start)

When a workspace is first loaded:

1. Fetch all items from each list (tasks, projects) with pagination.
2. Fetch all comments for all items (batched, parallel).
3. Map Graph payloads → Piper entities using the schema mapping engine.
4. Store the sync watermark: `{ lastSyncTimestamp, perItemETags }`.
5. Render the UI with fetched data.
6. Sync status → **"Synced"**.

**Watermark structure:**
```typescript
interface SyncWatermark {
  workspaceId: string
  pulledAt: string            // ISO timestamp of last successful pull
  itemETags: Map<string, string>  // entityId → last known etag
}
```

### 3.2 Push Sync (Piper → MS Lists)

Trigger: User edits an item (inline edit, detail panel save, drag-and-drop, comment).

**Flow:**

```
User edits field
      │
      ▼
[1] Optimistic UI update
      │  - Update local state immediately (TanStack Query cache)
      │  - Mark item as "syncing" in sync state store
      │
      ▼
[2] Map Piper field → Graph source field
      │  - Use WorkspaceConfig field mapping (depends on M3)
      │  - Reverse-normalize: Piper enum value → SharePoint choice value
      │  - Example: status "in-progress" → "In Progress"
      │
      ▼
[3] PATCH item via GraphClient
      │  - Include If-Match: {etag} for optimistic concurrency
      │  - On success: update local etag, mark item "synced"
      │  - On 412: Conflict → trigger conflict resolution
      │  - On network error: queue for retry, mark "pending-push"
      │
      ▼
[4] Update sync status indicator
```

**Push for specific operations:**

| Action | Graph API Call | Notes |
|--------|---------------|-------|
| Edit field | `PATCH /items/{id}` with `If-Match` | Map each Piper field to source field |
| Create task | `POST /items` | Map to fields; get back etag |
| Create comment | `POST /items/{id}/comments` | No etag needed |
| Delete task | `DELETE /items/{id}` | Future scope |
| Drag-drop reorder | `PATCH /items/{id}` | Update `SortOrder` field |

### 3.3 Pull Sync (MS Lists → Piper)

Trigger: Auto-sync interval (configurable, default 30s) or manual sync button.

**Incremental pull using delta filter:**

```
GET /sites/{siteId}/lists/{listId}/items
  ?$expand=fields($select=...)
  &$filter=lastModifiedDateTime gt {lastSyncTimestamp}
  &$top=200
```

**Flow:**

```
Timer fires / manual sync triggered
      │
      ▼
[1] Sync status → "Syncing"
      │
      ▼
[2] For each list (tasks, projects):
      │  Fetch items modified since last sync watermark
      │
      ▼
[3] Compare fetched items with local state
      │  - New items: add to local state
      │  - Changed items (different etag):
      │    a. If local has no pending edits → apply remote change
      │    b. If local has pending edits on same fields → conflict
      │  - Unchanged items (same etag): skip
      │
      ▼
[4] Update sync watermark
      │  - Set pulledAt to max(lastModifiedDateTime) from fetched items
      │  - Update per-item etags
      │
      ▼
[5] Refresh TanStack Query cache
      │
      ▼
[6] Sync status → "Synced" (or "Conflicts" if any detected)
```

### 3.4 Full Re-Sync

Triggered when:
- Watermark is older than 24 hours (staleness threshold)
- User clicks "Force Refresh"
- App detects schema mismatch after a pull

Full re-sync fetches all items (same as initial load) and reconciles against local state.

---

## 4. Sync State Model

### 4.1 Workspace-Level Sync Status

```typescript
type WorkspaceSyncStatus =
  | "idle"        // No sync in progress, data is fresh
  | "syncing"     // Pull or push in progress
  | "offline"     // Network unavailable; changes queued locally
  | "error"       // Last sync failed; user intervention needed
  | "conflicts"   // One or more conflicts awaiting resolution
```

### 4.2 Item-Level Sync Status

```typescript
type ItemSyncStatus =
  | "synced"            // Server and local are identical
  | "pending-push"      // Local edit not yet pushed (queued)
  | "pushing"           // Push in progress
  | "pending-pull"      // Remote change detected, not yet applied
  | "conflict"          // Both local and remote changed same field
  | "error"             // Push or pull failed for this item
```

### 4.3 Sync State Store

```typescript
interface SyncStateStore {
  // Workspace-level
  workspaceSyncStatus: Map<string, WorkspaceSyncStatus>
  lastSyncAt: Map<string, string>              // workspaceId → ISO timestamp
  syncError: Map<string, string | null>        // workspaceId → error message

  // Item-level
  itemSyncStatus: Map<string, ItemSyncStatus>  // entityId → status
  pendingOperations: Map<string, PendingOperation>  // entityId → queued op

  // Configuration
  syncIntervalMs: number    // Default: 30000 (30s)
  autoSyncEnabled: boolean  // Default: true
}
```

---

## 5. Conflict Resolution

### 5.1 Conflict Detection

A conflict occurs when:
1. User edits field F on item I in Piper (local change, not yet pushed)
2. Another user (or the same user in a browser) edits the same field F on item I in MS Lists
3. Piper's push (step 3.2) gets `412 Precondition Failed` OR pull (step 3.3) detects both local and remote changes to the same field

### 5.2 Conflict Resolution Strategy

**Default: Last-Write-Wins (automatic)**

If the conflict is on a field that the current user didn't change locally (false alarm — different fields changed), auto-merge: apply remote changes to non-conflicting fields, keep local changes on the field the user actually edited.

**Escalation: Manual Resolution**

If the same field was edited both locally and remotely:

1. Pause push for this item.
2. Show a conflict banner in the UI:

```
┌──────────────────────────────────────────────────────────────┐
│ ⚠ Sync Conflict on "Implement Graph pagination"              │
│                                                              │
│ Field: Status                                                │
│                                                              │
│   Your version:     [In Progress]                            │
│   Server version:   [Done]                                   │
│                                                              │
│   [Keep Yours]  [Use Server]  [View Both]                    │
└──────────────────────────────────────────────────────────────┘
```

3. User picks one or manually merges.
4. Push the resolved version.

### 5.3 Conflict State Machine

```
                    ┌──────────┐
                    │  Synced  │
                    └────┬─────┘
                         │ edit locally
                         ▼
                    ┌──────────┐
              ┌────▶│ Pending  │◀───┐
              │     │ Push     │    │
              │     └────┬─────┘    │
              │          │ push     │ conflict auto-resolved
              │          ▼          │
              │     ┌──────────┐   │
              │     │ Pushing  │   │
              │     └────┬─────┘   │
              │          │         │
              │   ┌──────┴─────┐   │
              │   │            │   │
              │ 412/network   OK   │
              │   │            │   │
              │   ▼            ▼   │
              │ ┌──────────┐ ┌───┴──┐
              │ │ Conflict │ │Synced│
              │ └────┬─────┘ └──────┘
              │      │ user resolves
              │      ▼
              │ ┌──────────┐
              └─│ Retrying │
                └──────────┘
```

---

## 6. Offline Resilience

### 6.1 Operation Queue

When the network is unavailable, all write operations are queued locally:

```typescript
interface PendingOperation {
  id: string
  entityId: string
  entityType: "task" | "project" | "comment"
  operationType: "create" | "update" | "delete"
  payload: Record<string, unknown>
  createdAt: string
  retryCount: number
  maxRetries: number  // Default: 5
}
```

### 6.2 Offline Behavior

1. **Detection:** Piper detects offline state when a Graph API call fails with a network error (no response).
2. **Queueing:** All subsequent writes are stored in the operation queue.
3. **UI Indicator:** Topbar shows "Offline — N changes pending" with count badge.
4. **Local state:** TanStack Query cache serves as the local state. Edits apply optimistically.
5. **Reconnection:** When network returns, replay queued operations in FIFO order.
6. **Conflict handling:** If a replayed operation hits 412, go through conflict resolution flow.

### 6.3 Offline Limits

- Maximum queued operations: 100 (oldest dropped with warning if exceeded)
- Queue is persisted to `localStorage` (or CR-SQLite when available)
- Queue is cleared on workspace switch

---

## 7. Sync Status UI

### 7.1 Topbar Indicator

The sync status lives in the topbar, always visible:

```
┌──────────────────────────────────────────────────────────┐
│ 🔵 Piper │ My Workspace │ [Search...] │ ⏱ Synced 3s ago │
└──────────────────────────────────────────────────────────┘
```

**States and indicators:**

| Status | Icon | Label | Color | Action on Click |
|--------|------|-------|-------|-----------------|
| idle/synced | ✓ | "Synced" / "Synced Ns ago" | Green | Show last sync timestamp tooltip |
| syncing | ⟳ | "Syncing..." | Blue (animated) | None |
| offline | ⚠ | "Offline — N changes queued" | Orange | Show queue details |
| error | ✕ | "Sync error — tap to retry" | Red | Trigger manual sync |
| conflicts | ⚡ | "N conflicts" | Yellow | Open conflict panel |

### 7.2 Item-Level Indicators

In list/kanban views, items with sync issues show a subtle indicator:

| Status | Visual |
|--------|--------|
| pending-push | Small dot on item card (orange) |
| pushing | Small spinner on item card (blue) |
| conflict | Yellow border + ⚡ icon |
| error | Red dot + tooltip with error message |

### 7.3 Detail Panel Sync Bar

When viewing a specific item, show a contextual sync bar:

```
┌──────────────────────────────────────────────┐
│ ⚠ This task was modified externally.         │
│   Status changed from "In Progress" to "Done"│
│   [Keep Your Version] [Accept Remote]        │
└──────────────────────────────────────────────┘
```

---

## 8. Configuration

### 8.1 Sync Settings (in Settings page or workspace config)

```typescript
interface SyncConfig {
  // Auto-sync
  autoSyncEnabled: boolean       // Default: true
  syncIntervalMs: number         // Default: 30000 (30s), min: 5000 (5s), max: 300000 (5min)

  // Conflict resolution
  defaultConflictStrategy: "last-write-wins" | "prompt-always"

  // Offline
  offlineQueueEnabled: boolean   // Default: true
  maxQueuedOperations: number    // Default: 100

  // Full re-sync threshold
  fullResyncAfterMs: number      // Default: 86400000 (24h)
}
```

### 8.2 Workspace Config Extension

Add sync settings to `WorkspaceConfig`:

```json
{
  "workspace": { ... },
  "lists": { ... },
  "views": [ ... ],
  "sync": {
    "intervalSeconds": 30,
    "conflictStrategy": "last-write-wins"
  }
}
```

---

## 9. Microsoft Graph API Requirements

### 9.1 Delta Queries (Preferred)

SharePoint Lists support delta queries via the Graph API:

```
GET /sites/{siteId}/lists/{listId}/items/delta
```

This returns a delta token that can be used for subsequent incremental fetches:

```
GET /sites/{siteId}/lists/{listId}/items/delta?$deltatoken={token}
```

**If delta queries are available:** Use them instead of timestamp-based filtering. They provide a reliable change log with create/update/delete markers.

**If delta queries are NOT available:** Fall back to `$filter=lastModifiedDateTime gt {watermark}` with etag comparison.

### 9.2 ETags for Concurrency

Every Graph list item includes an `etag` field. Use `If-Match: {etag}` on all PATCH operations for optimistic concurrency control.

### 9.3 Webhooks (Future Enhancement)

For real-time push notifications, register a Graph subscription:

```
POST /subscriptions
{
  "changeType": "updated,created,deleted",
  "notificationUrl": "...",
  "resource": "/sites/{siteId}/lists/{listId}/items",
  "expirationDateTime": "..."
}
```

This is out of scope for M4 but the architecture should accommodate it. The sync engine should expose a `onRemoteChange(event)` method that a webhook handler can call.

---

## 10. Error Handling

### 10.1 Error Categories

| Error | HTTP Code | User Message | Recovery |
|-------|-----------|-------------|----------|
| Token expired | 401 | "Re-authenticating..." | Auto-refresh token, retry |
| Rate limited | 429 | "Sync paused (rate limited)" | Respect Retry-After header |
| Conflict | 412 | "This item was edited elsewhere" | Conflict resolution flow |
| Not found | 404 | "Item no longer exists on server" | Mark item as orphaned, prompt user |
| Validation error | 400 | "Server rejected the change: {details}" | Show validation error inline |
| Server error | 500/502/504 | "Sync temporarily unavailable" | Retry with backoff |
| Network error | — | "You're offline — changes will sync when connected" | Queue operations |

### 10.2 Retry Policy

```typescript
const defaultRetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  retryableStatuses: [401, 429, 500, 502, 503, 504],
  retryOnNetworkError: true,
}
```

(Already specified in `graph-integration.md` section 6.2 — sync engine reuses this.)

---

## 11. Reverse Field Mapping (Piper → Graph)

### 11.1 Status Mapping (Piper → MS Lists)

```typescript
const piperToGraphStatus: Record<WorkspaceTask["status"], string> = {
  "backlog": "Backlog",
  "planned": "Not Started",
  "in-progress": "In Progress",
  "blocked": "Blocked",
  "in-review": "In Review",
  "done": "Done",
}
```

### 11.2 Priority Mapping (Piper → MS Lists)

```typescript
const piperToGraphPriority: Record<WorkspaceTask["priority"], string> = {
  "low": "Low",
  "medium": "Medium",
  "high": "High",
  "urgent": "Urgent",
}
```

### 11.3 Field-Specific Serialization

| Piper Field | Graph Serialization | Notes |
|-------------|-------------------|-------|
| person | `{ Email: "user@example.com" }` or lookup by email | Person field type |
| lookup | `{ LookupId: N }` | Extract ID from entity ID |
| choice | String value from reverse map | Status, priority |
| labels | Semicolon-joined string | `"bug;ui;critical"` |
| date | ISO date string | `"2026-04-01"` |
| text | Direct string | No transformation |
| number | Direct number | No transformation |

---

## 12. Acceptance Criteria

### 12.1 Push Sync (Piper → MS Lists)

| # | Criterion | Validation |
|---|-----------|------------|
| P1 | Editing a task field in Piper updates the corresponding SharePoint item within 5 seconds | Manual test: edit in Piper, verify in SharePoint |
| P2 | Creating a task in Piper creates a SharePoint list item | Manual test: create in Piper, verify in SharePoint |
| P3 | Adding a comment in Piper creates a SharePoint comment | Manual test: comment in Piper, verify in SharePoint |
| P4 | Drag-and-drop status change on Kanban updates SharePoint immediately | Manual test |
| P5 | Failed pushes show error indicator on the item | Visual verification |
| P6 | Failed pushes are retried automatically (up to 3 times) | Log verification |

### 12.2 Pull Sync (MS Lists → Piper)

| # | Criterion | Validation |
|---|-----------|------------|
| L1 | Changes made in SharePoint appear in Piper within the configured sync interval | Edit in SharePoint, wait for interval, verify in Piper |
| L2 | Manual "Sync Now" triggers immediate pull | Click sync button, verify data refreshes |
| L3 | Only changed items are fetched (not full re-sync) | Network tab: verify filtered query with timestamp |
| L4 | New items created in SharePoint appear in Piper | Create in SharePoint, verify in Piper |
| L5 | Items deleted in SharePoint are removed from Piper (or marked) | Delete in SharePoint, verify |

### 12.3 Conflict Resolution

| # | Criterion | Validation |
|---|-----------|------------|
| C1 | Concurrent edits to different fields on the same item auto-merge without user intervention | Edit field A in Piper, field B in SharePoint, sync — both changes present |
| C2 | Concurrent edits to the same field show a conflict resolution prompt | Edit same field in both, sync — prompt appears |
| C3 | User can choose "Keep Mine" or "Use Server" for conflicting fields | Click each option, verify correct behavior |
| C4 | No data is ever silently lost — user always has the option to see both versions | Verify both values are shown before resolution |

### 12.4 Sync Status UI

| # | Criterion | Validation |
|---|-----------|------------|
| S1 | Topbar shows current sync status at all times | Verify each state |
| S2 | Offline indicator appears when network is unavailable | Disconnect network, verify indicator |
| S3 | Pending operation count is shown in offline mode | Make edits offline, verify count |
| S4 | Item-level sync indicators are visible in list and kanban views | Verify dots/badges on items |

### 12.5 Offline Resilience

| # | Criterion | Validation |
|---|-----------|------------|
| O1 | Edits made offline are queued and replayed when connection returns | Edit offline, reconnect, verify changes appear in SharePoint |
| O2 | Queue survives app restart | Edit offline, close app, reopen, reconnect — changes sync |
| O3 | Offline indicator shows queued operation count | Visual verification |

### 12.6 Performance

| # | Criterion | Validation |
|---|-----------|------------|
| F1 | Pull sync fetches only changed items (delta/incremental) | Network inspection: verify filtered query |
| F2 | Initial full sync completes in under 10 seconds for 500 items | Timed test |
| F3 | Push operations return within 3 seconds on normal network | Timed test |
| F4 | UI remains responsive during sync (no blocking) | Visual verification during sync |

---

## 13. Implementation Phases

### Phase M4a — Core Push (depends on M3)

- Implement reverse field mapping (Piper → Graph field values)
- Add `createItem`, `updateItem`, `createComment` to `GraphClient` and `FetchGraphClient`
- Implement write-through in repository: `updateTask` and `createTask` call Graph
- Optimistic UI updates with TanStack Query `onMutate`
- Basic error handling (token refresh, retry)

### Phase M4b — Pull Sync

- Sync state store (zustand or React context)
- Sync watermark tracking (per-workspace)
- Incremental pull using `$filter` with `lastModifiedDateTime`
- Full re-sync fallback
- Auto-sync interval timer
- Manual sync trigger button

### Phase M4c — Conflict Resolution

- ETag tracking per item
- Conflict detection on 412 responses and pull diff
- Auto-merge for non-overlapping field changes
- Conflict resolution UI component
- Manual resolution flow

### Phase M4d — Offline & Polish

- Operation queue with persistence (localStorage)
- Offline detection and queue replay
- Topbar sync status indicator
- Item-level sync status indicators
- Settings: sync interval, conflict strategy
- Edge cases: 404 (deleted elsewhere), validation errors

---

## 14. Dependencies & Integration Points

| Dependency | Status | Notes |
|------------|--------|-------|
| M1: OAuth2 auth (NEV-13) | ✅ Done | Token provider available |
| M2: CRUD operations (NEV-14) | ✅ Done | Read path works; write path is placeholder |
| M3: Schema mapping (NEV-81) | ❌ TODO (Critical) | **Blocker.** Sync engine needs `WorkspaceConfig.fields` to map Piper fields ↔ Graph fields |
| M5: UI integration (NEV-17) | ✅ Done | Views and detail panel functional |
| NEV-24: IssueStore trait | ✅ Done | `PiperRepository` interface stable |
| `GraphClient` write methods | ❌ Missing | `createItem`, `updateItem` not yet on interface |

### M3 Unblocker

M3 must deliver:
1. Config-driven field mapping from Piper semantic fields to SharePoint source columns
2. `getFieldValue()` helper that reads `item.fields[sourceField]`
3. Reverse mapping: given a Piper semantic value, produce the SharePoint column value

Until M3 is complete, the sync engine cannot push or pull because it doesn't know which SharePoint columns correspond to which Piper fields.

---

## 15. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Graph delta queries not available for SharePoint Lists | Full re-sync on every pull | Use `$filter` with `lastModifiedDateTime` as fallback |
| ETag unreliability on SharePoint items | Silent overwrites | Add `lastModifiedDateTime` check as secondary guard |
| Rate limiting on large lists | Sync stalling | Respect `Retry-After`, increase interval adaptively |
| Offline queue overflow | Data loss | Cap queue size, warn user, persist to storage |
| Complex field types (person multi, lookup multi) | Mapping errors | Test with real tenant data; add field-type-specific serializers |
| Schema changes in SharePoint | Broken mappings | Detect on pull, prompt user to update workspace config |

---

## 16. Out of Scope for M4

- Webhook-based real-time push notifications (future)
- P2P sync between Piper instances (NEV-25)
- Other backend adapters (GitHub, Jira, Linear)
- Gantt/timeline view sync
- Attachment upload/download
- Batch operations (bulk status change)
- Undo/redo for synced operations
