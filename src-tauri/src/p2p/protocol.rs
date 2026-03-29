//! Sync protocol types — messages exchanged between Piper peers.
//!
//! The protocol uses a simple request/response + gossip model:
//! 1. **Gossip channel** — broadcast presence and change announcements
//! 2. **Direct connections** — pull full state snapshots, resolve conflicts

use serde::{Deserialize, Serialize};
use std::fmt;

/// Unique identifier for a Piper peer (iroh node public key as hex).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct PeerId(pub String);

impl fmt::Display for PeerId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl PeerId {
    pub fn from_bytes(bytes: &[u8]) -> Self {
        Self(hex::encode(bytes))
    }
}

/// Identifies a sync scope — a workspace + backend combination.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SyncScope {
    pub workspace_id: String,
    pub backend_id: String,
}

/// A single field-level change to an entity.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldChange {
    pub field: String,
    pub old_value: Option<serde_json::Value>,
    pub new_value: Option<serde_json::Value>,
}

/// An operation in the sync protocol.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOperation {
    /// Monotonically increasing sequence number (per scope + peer).
    pub seq: u64,
    /// Which scope this operation belongs to.
    pub scope: SyncScope,
    /// Authoring peer.
    pub author: PeerId,
    /// ISO 8601 timestamp.
    pub timestamp: String,
    /// The entity type ("task", "project", "comment").
    pub entity_type: String,
    /// The entity ID.
    pub entity_id: String,
    /// Operation type.
    pub op_type: OpType,
    /// For create: full entity JSON. For update: field changes. For delete: empty.
    pub payload: serde_json::Value,
}

/// Type of sync operation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum OpType {
    Create,
    Update,
    Delete,
}

/// Gossip message — broadcast to all peers in a topic.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GossipMessage {
    /// Announce this peer's presence.
    PresenceAnnounce(PresenceAnnounce),
    /// Notify peers about new operations.
    ChangeAnnouncement(ChangeAnnouncement),
    /// Request a state snapshot from peers.
    SnapshotRequest(SnapshotRequest),
}

/// Presence announcement — who we are and what scopes we're interested in.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresenceAnnounce {
    pub peer: PeerId,
    pub device_name: String,
    pub scopes: Vec<SyncScope>,
    pub timestamp: String,
}

/// Announcement of new changes available at this peer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeAnnouncement {
    pub peer: PeerId,
    pub scope: SyncScope,
    /// Sequence range of new operations.
    pub from_seq: u64,
    pub to_seq: u64,
    /// Hash of the operations for integrity check.
    pub operations_hash: String,
    pub timestamp: String,
}

/// Request for a full state snapshot from a peer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotRequest {
    pub requester: PeerId,
    pub scope: SyncScope,
    /// Requester's last known seq — peer will send everything after this.
    pub since_seq: u64,
}

/// Response to a snapshot request — sent over a direct connection.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotResponse {
    pub scope: SyncScope,
    pub operations: Vec<SyncOperation>,
    /// Current watermark after applying these operations.
    pub watermark_seq: u64,
}

/// Conflict detected during merge.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncConflict {
    pub scope: SyncScope,
    pub entity_id: String,
    pub entity_type: String,
    pub field: String,
    pub local_value: serde_json::Value,
    pub remote_value: serde_json::Value,
    pub local_timestamp: String,
    pub remote_timestamp: String,
    pub local_author: PeerId,
    pub remote_author: PeerId,
}

/// Resolution strategy for a conflict.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum ConflictResolution {
    /// Use the local value.
    KeepLocal,
    /// Use the remote value.
    KeepRemote,
    /// Merge non-conflicting fields, use latest timestamp for conflicting.
    LastWriteWins,
    /// Merge field by field using provided values.
    FieldMerge(serde_json::Value),
}

/// Result of a sync round.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncRoundResult {
    pub scope: SyncScope,
    pub pulled: u64,
    pub pushed: u64,
    pub conflicts: Vec<SyncConflict>,
    pub errors: Vec<String>,
    pub duration_ms: u64,
}

/// Status of the P2P sync service.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum SyncServiceStatus {
    Stopped,
    Starting,
    Running,
    Error(String),
}

/// Info about a connected peer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub peer_id: PeerId,
    pub device_name: String,
    pub scopes: Vec<SyncScope>,
    pub connected_at: String,
    pub last_seen: String,
    pub online: bool,
}

// Minimal hex encoding (avoid extra dep)
mod hex {
    pub fn encode(bytes: &[u8]) -> String {
        bytes.iter().map(|b| format!("{:02x}", b)).collect()
    }
}
