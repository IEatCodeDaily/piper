//! Presence detection — track which peers are online and what they sync.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use tokio::sync::RwLock;

use crate::p2p::protocol::{PeerId, PeerInfo, PresenceAnnounce, SyncScope};

/// How long before a peer is considered offline (seconds).
const PRESENCE_TIMEOUT_SECS: i64 = 60;

#[derive(Debug, Clone)]
struct PeerState {
    peer_id: PeerId,
    device_name: String,
    scopes: Vec<SyncScope>,
    last_seen: DateTime<Utc>,
    connected_at: DateTime<Utc>,
    online: bool,
}

/// Manages the set of known peers and their presence state.
#[derive(Debug, Clone)]
pub struct PresenceManager {
    peers: Arc<RwLock<HashMap<PeerId, PeerState>>>,
}

impl PresenceManager {
    pub fn new() -> Self {
        Self {
            peers: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Record a presence announcement from a peer.
    pub async fn handle_announce(&self, announce: PresenceAnnounce) {
        let mut peers = self.peers.write().await;
        let now = Utc::now();
        let peer_id = announce.peer.clone();

        peers
            .entry(peer_id.clone())
            .and_modify(|state| {
                state.device_name = announce.device_name.clone();
                state.scopes = announce.scopes.clone();
                state.last_seen = now;
                state.online = true;
            })
            .or_insert(PeerState {
                peer_id,
                device_name: announce.device_name,
                scopes: announce.scopes,
                last_seen: now,
                connected_at: now,
                online: true,
            });
    }

    /// Mark a peer as disconnected.
    pub async fn remove_peer(&self, peer_id: &PeerId) {
        let mut peers = self.peers.write().await;
        if let Some(state) = peers.get_mut(peer_id) {
            state.online = false;
        }
    }

    /// Check for stale peers and mark them offline.
    pub async fn check_timeouts(&self) {
        let mut peers = self.peers.write().await;
        let now = Utc::now();
        let timeout = chrono::Duration::seconds(PRESENCE_TIMEOUT_SECS);

        for state in peers.values_mut() {
            if now - state.last_seen > timeout {
                state.online = false;
            }
        }
    }

    /// Get all known peers.
    pub async fn list_peers(&self) -> Vec<PeerInfo> {
        let peers = self.peers.read().await;
        peers
            .values()
            .map(|state| PeerInfo {
                peer_id: state.peer_id.clone(),
                device_name: state.device_name.clone(),
                scopes: state.scopes.clone(),
                connected_at: state.connected_at.to_rfc3339(),
                last_seen: state.last_seen.to_rfc3339(),
                online: state.online,
            })
            .collect()
    }

    /// Get peers interested in a specific scope.
    pub async fn peers_for_scope(&self, scope: &SyncScope) -> Vec<PeerInfo> {
        let peers = self.peers.read().await;
        peers
            .values()
            .filter(|state| state.scopes.contains(scope))
            .map(|state| PeerInfo {
                peer_id: state.peer_id.clone(),
                device_name: state.device_name.clone(),
                scopes: state.scopes.clone(),
                connected_at: state.connected_at.to_rfc3339(),
                last_seen: state.last_seen.to_rfc3339(),
                online: state.online,
            })
            .collect()
    }

    /// Get count of online peers.
    pub async fn online_count(&self) -> usize {
        let peers = self.peers.read().await;
        peers.values().filter(|s| s.online).count()
    }
}
