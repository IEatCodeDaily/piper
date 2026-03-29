//! Selective sync — filter which scopes and entities participate in P2P sync.
//!
//! Users can choose to sync only specific workspaces and backends,
//! reducing bandwidth and avoiding unwanted data transfer.

use serde::{Deserialize, Serialize};

use crate::p2p::protocol::SyncScope;

/// Configuration for selective sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncFilter {
    /// If non-empty, only these workspace IDs will sync. Empty = all.
    pub workspace_ids: Vec<String>,
    /// If non-empty, only these backend IDs will sync. Empty = all.
    pub backend_ids: Vec<String>,
    /// Maximum number of operations to send per sync round.
    pub max_ops_per_round: usize,
    /// Whether to sync completed/done items.
    pub sync_completed: bool,
}

impl Default for SyncFilter {
    fn default() -> Self {
        Self {
            workspace_ids: Vec::new(),
            backend_ids: Vec::new(),
            max_ops_per_round: 500,
            sync_completed: true,
        }
    }
}

impl SyncFilter {
    pub fn new() -> Self {
        Self::default()
    }

    /// Restrict sync to specific workspaces.
    pub fn with_workspaces(mut self, ids: Vec<String>) -> Self {
        self.workspace_ids = ids;
        self
    }

    /// Restrict sync to specific backends.
    pub fn with_backends(mut self, ids: Vec<String>) -> Self {
        self.backend_ids = ids;
        self
    }

    /// Set whether to sync completed items.
    pub fn with_sync_completed(mut self, sync: bool) -> Self {
        self.sync_completed = sync;
        self
    }

    /// Check if a given scope passes the filter.
    pub fn allows_scope(&self, scope: &SyncScope) -> bool {
        let workspace_ok = self.workspace_ids.is_empty()
            || self.workspace_ids.contains(&scope.workspace_id);
        let backend_ok =
            self.backend_ids.is_empty() || self.backend_ids.contains(&scope.backend_id);
        workspace_ok && backend_ok
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_filter_allows_all() {
        let filter = SyncFilter::default();
        let scope = SyncScope {
            workspace_id: "ws-1".into(),
            backend_id: "sqlite".into(),
        };
        assert!(filter.allows_scope(&scope));
    }

    #[test]
    fn test_workspace_filter_blocks_non_matching() {
        let filter = SyncFilter::new().with_workspaces(vec!["ws-1".into()]);
        let matching = SyncScope {
            workspace_id: "ws-1".into(),
            backend_id: "sqlite".into(),
        };
        let non_matching = SyncScope {
            workspace_id: "ws-2".into(),
            backend_id: "sqlite".into(),
        };
        assert!(filter.allows_scope(&matching));
        assert!(!filter.allows_scope(&non_matching));
    }

    #[test]
    fn test_backend_filter_blocks_non_matching() {
        let filter = SyncFilter::new().with_backends(vec!["sqlite".into()]);
        let matching = SyncScope {
            workspace_id: "ws-1".into(),
            backend_id: "sqlite".into(),
        };
        let non_matching = SyncScope {
            workspace_id: "ws-1".into(),
            backend_id: "github".into(),
        };
        assert!(filter.allows_scope(&matching));
        assert!(!filter.allows_scope(&non_matching));
    }

    #[test]
    fn test_combined_filter() {
        let filter = SyncFilter::new()
            .with_workspaces(vec!["ws-1".into()])
            .with_backends(vec!["sqlite".into()]);

        // Matches both
        assert!(filter.allows_scope(&SyncScope {
            workspace_id: "ws-1".into(),
            backend_id: "sqlite".into(),
        }));

        // Workspace matches but backend doesn't
        assert!(!filter.allows_scope(&SyncScope {
            workspace_id: "ws-1".into(),
            backend_id: "github".into(),
        }));

        // Backend matches but workspace doesn't
        assert!(!filter.allows_scope(&SyncScope {
            workspace_id: "ws-2".into(),
            backend_id: "sqlite".into(),
        }));
    }
}
