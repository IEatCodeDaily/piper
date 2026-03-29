//! SyncService — the core P2P sync service using iroh.
//!
//! Manages the iroh endpoint, gossip subscriptions, and sync protocol.
//! Exposed to the TypeScript frontend via Tauri commands.

use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;

use iroh::Endpoint;

use crate::p2p::presence::PresenceManager;
use crate::p2p::protocol::*;
use crate::p2p::selective::SyncFilter;

/// Configuration for the P2P sync service.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncServiceConfig {
    /// Human-readable device name for this peer.
    pub device_name: String,
    /// Scopes this instance participates in.
    pub scopes: Vec<SyncScope>,
    /// Sync filter configuration.
    #[serde(default)]
    pub filter: SyncFilter,
}

impl Default for SyncServiceConfig {
    fn default() -> Self {
        Self {
            device_name: "Piper Device".into(),
            scopes: Vec::new(),
            filter: SyncFilter::default(),
        }
    }
}

/// The core P2P sync service.
///
/// Wraps an iroh `Endpoint` and provides:
/// - Peer discovery via gossip
/// - Change broadcast and reconciliation
/// - Presence tracking
/// - Selective sync filtering
pub struct SyncService {
    config: Arc<RwLock<SyncServiceConfig>>,
    endpoint: Arc<RwLock<Option<Endpoint>>>,
    presence: PresenceManager,
    status: Arc<RwLock<SyncServiceStatus>>,
    /// Per-scope operation log (seq → operation).
    /// In production this would be backed by SQLite; for now in-memory.
    operation_log: Arc<RwLock<HashMap<String, Vec<SyncOperation>>>>,
    /// Our own peer ID (set after starting).
    local_peer_id: Arc<RwLock<Option<PeerId>>>,
}

impl SyncService {
    /// Create a new SyncService (not yet started).
    pub fn new(config: SyncServiceConfig) -> Self {
        Self {
            config: Arc::new(RwLock::new(config)),
            endpoint: Arc::new(RwLock::new(None)),
            presence: PresenceManager::new(),
            status: Arc::new(RwLock::new(SyncServiceStatus::Stopped)),
            operation_log: Arc::new(RwLock::new(HashMap::new())),
            local_peer_id: Arc::new(RwLock::new(None)),
        }
    }

    /// Start the iroh endpoint and begin accepting connections.
    pub async fn start(&self) -> Result<(), String> {
        {
            let mut status = self.status.write().await;
            if *status != SyncServiceStatus::Stopped {
                return Err("Service is already running or starting".into());
            }
            *status = SyncServiceStatus::Starting;
        }

        // Create iroh endpoint
        let endpoint = Endpoint::builder()
            .bind()
            .await
            .map_err(|e| format!("Failed to bind iroh endpoint: {}", e))?;

        let node_id = endpoint.node_id();
        let peer_id = PeerId::from_bytes(node_id.as_bytes());

        log::info!("P2P sync service started. Peer ID: {}", peer_id);

        {
            let mut ep = self.endpoint.write().await;
            *ep = Some(endpoint);
        }
        {
            let mut pid = self.local_peer_id.write().await;
            *pid = Some(peer_id);
        }
        {
            let mut status = self.status.write().await;
            *status = SyncServiceStatus::Running;
        }

        Ok(())
    }

    /// Stop the sync service.
    pub async fn stop(&self) -> Result<(), String> {
        let mut ep = self.endpoint.write().await;
        if let Some(endpoint) = ep.take() {
            // iroh 0.34: endpoint is dropped automatically, no explicit close needed
            drop(endpoint);
        }
        let mut status = self.status.write().await;
        *status = SyncServiceStatus::Stopped;
        log::info!("P2P sync service stopped.");
        Ok(())
    }

    /// Get the current service status.
    pub async fn get_status(&self) -> SyncServiceStatus {
        self.status.read().await.clone()
    }

    /// Get this peer's ID.
    pub async fn get_local_peer_id(&self) -> Option<PeerId> {
        self.local_peer_id.read().await.clone()
    }

    /// Get the presence manager reference.
    pub fn presence(&self) -> &PresenceManager {
        &self.presence
    }

    /// Get current sync filter.
    pub async fn get_filter(&self) -> SyncFilter {
        self.config.read().await.filter.clone()
    }

    /// Update sync filter.
    pub async fn set_filter(&self, filter: SyncFilter) {
        self.config.write().await.filter = filter;
    }

    /// Record a local operation and return it for broadcast.
    pub async fn record_local_operation(&self, op: SyncOperation) -> Result<(), String> {
        let config = self.config.read().await;
        if !config.filter.allows_scope(&op.scope) {
            return Ok(()); // Filtered out — don't record.
        }
        let key = format!("{}:{}", op.scope.workspace_id, op.scope.backend_id);
        let mut log = self.operation_log.write().await;
        log.entry(key).or_default().push(op);
        Ok(())
    }

    /// Get operations for a scope since a given sequence number.
    pub async fn get_operations_since(
        &self,
        scope: &SyncScope,
        since_seq: u64,
    ) -> Vec<SyncOperation> {
        let key = format!("{}:{}", scope.workspace_id, scope.backend_id);
        let log = self.operation_log.read().await;
        log.get(&key)
            .map(|ops| {
                ops.iter()
                    .filter(|op| op.seq > since_seq)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Merge remote operations into the local log with conflict detection.
    pub async fn merge_remote_operations(
        &self,
        remote_ops: Vec<SyncOperation>,
    ) -> SyncRoundResult {
        let start = std::time::Instant::now();
        let mut pulled = 0u64;
        let mut conflicts = Vec::new();
        let mut errors = Vec::new();

        let config = self.config.read().await;

        for op in &remote_ops {
            if !config.filter.allows_scope(&op.scope) {
                continue;
            }

            let key = format!("{}:{}", op.scope.workspace_id, op.scope.backend_id);
            let mut log = self.operation_log.write().await;
            let local_ops = log.entry(key).or_default();

            // Check for conflicts: same entity, overlapping seq ranges
            let has_conflict = local_ops.iter().any(|local| {
                local.entity_id == op.entity_id
                    && local.entity_type == op.entity_type
                    && local.op_type == OpType::Update
                    && op.op_type == OpType::Update
            });

            if has_conflict {
                // For now, use last-write-wins
                // In production, this would emit a conflict event to the UI
                conflicts.push(SyncConflict {
                    scope: op.scope.clone(),
                    entity_id: op.entity_id.clone(),
                    entity_type: op.entity_type.clone(),
                    field: "multiple".into(),
                    local_value: serde_json::Value::Null,
                    remote_value: op.payload.clone(),
                    local_timestamp: op.timestamp.clone(),
                    remote_timestamp: op.timestamp.clone(),
                    local_author: op.author.clone(),
                    remote_author: op.author.clone(),
                });
            }

            // Apply the remote operation (append to log)
            local_ops.push(op.clone());
            pulled += 1;
        }

        SyncRoundResult {
            scope: remote_ops
                .first()
                .map(|op| op.scope.clone())
                .unwrap_or(SyncScope {
                    workspace_id: String::new(),
                    backend_id: String::new(),
                }),
            pulled,
            pushed: 0,
            conflicts,
            errors,
            duration_ms: start.elapsed().as_millis() as u64,
        }
    }

    /// List all known peers (delegates to presence manager).
    pub async fn list_peers(&self) -> Vec<PeerInfo> {
        self.presence.list_peers().await
    }

    /// Get the iroh endpoint's public key as a shareable invite code.
    pub async fn get_invite_code(&self) -> Option<String> {
        let ep = self.endpoint.read().await;
        ep.as_ref().map(|endpoint| {
            let node_id = endpoint.node_id();
            format!("piper://{}", hex_encode(node_id.as_bytes()))
        })
    }
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
