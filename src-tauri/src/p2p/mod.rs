//! Piper P2P Sync — iroh-based peer-to-peer issue synchronization.
//!
//! This module provides P2P networking between Piper instances using iroh
//! for QUIC-based connections identified by public keys. It implements:
//!
//! - **Presence detection** — know which peers are online
//! - **Change broadcast** — push local changes to connected peers
//! - **State reconciliation** — pull changes from peers and merge
//! - **Selective sync** — filter by workspace and backend
//!
//! # Architecture
//!
//! ```text
//!  ┌───────────────────────────────────────────┐
//!  │ TypeScript Frontend                        │
//!  │  (via Tauri commands)                      │
//!  └──────────────┬────────────────────────────┘
//!                 │
//!  ┌──────────────▼────────────────────────────┐
//!  │ SyncService (Rust)                        │
//!  │  - manages iroh Endpoint                  │
//!  │  - runs gossip for presence               │
//!  │  - handles sync protocol                  │
//!  │  - selective sync filtering               │
//!  └──────────────┬────────────────────────────┘
//!                 │
//!  ┌──────────────▼────────────────────────────┐
//!  │ iroh Endpoint (QUIC P2P)                  │
//!  │  - public key addressing                  │
//!  │  - NAT traversal / relay fallback         │
//!  │  - encrypted channels                     │
//!  └───────────────────────────────────────────┘
//! ```

pub mod protocol;
pub mod service;
pub mod presence;
pub mod selective;

pub use protocol::*;
pub use service::{SyncService, SyncServiceConfig};
pub use presence::PresenceManager;
pub use selective::SyncFilter;
