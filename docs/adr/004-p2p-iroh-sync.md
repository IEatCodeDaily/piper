# ADR-004: iroh-based P2P Sync Between Piper Instances

**Date:** 2026-03-29
**Status:** Accepted
**Issue:** NEV-25

## Context

Piper needs peer-to-peer issue sync between devices without a central server. This enables true offline-first collaboration where multiple Piper instances can exchange issue state directly.

Requirements:
- Sync issue state between devices without a central server
- Conflict resolution for concurrent edits
- Presence detection (which peers are online)
- Selective sync (per-workspace, per-backend)

## Decision

Use **iroh** (v0.97) as the P2P networking layer. iroh provides:
- **QUIC connections dialed by public key** — no IP addresses needed
- **NAT traversal with relay fallback** — works across networks
- **Encrypted channels** — all traffic is TLS 1.3
- **iroh-gossip** for broadcast messaging (presence, change announcements)

### Protocol Design

1. **Gossip layer**: Broadcast presence announcements and change notifications
2. **Direct connections**: Pull full state snapshots for reconciliation
3. **Operation log**: Per-scope sequence-numbered operations for conflict detection
4. **Selective sync**: Filter by workspace ID and backend ID

### Architecture

```
TypeScript Frontend
  ↕ (Tauri commands)
SyncService (Rust)
  ↕
iroh Endpoint (QUIC P2P)
  ↕
Other Piper instances
```

The sync service is implemented in Rust (Tauri backend) and exposed to the React frontend via Tauri commands. It works with the `IssueStore` abstraction layer, so it's backend-agnostic.

### Conflict Resolution

Default strategy is **last-write-wins** with timestamp comparison. The protocol emits `SyncConflict` events that the UI can surface for manual resolution when needed.

## Consequences

**Positive:**
- No vendor lock-in on sync infrastructure
- Works fully offline with eventual consistency
- Leverages iroh's mature NAT traversal
- Backend-agnostic through IssueStore interface

**Negative:**
- Adds ~5MB to binary size (iroh runtime)
- Requires rust-version 1.89+ (up from 1.77.2)
- Initial implementation is in-memory (needs SQLite backing from NEV-19)
- Bootstrap requires sharing peer IDs out-of-band

## Files Changed

- `src-tauri/Cargo.toml` — iroh, iroh-gossip, and utility deps
- `src-tauri/src/lib.rs` — Tauri command registration
- `src-tauri/src/p2p/` — Rust P2P module (mod, protocol, service, presence, selective)
- `src/lib/p2p/index.ts` — TypeScript frontend bridge
