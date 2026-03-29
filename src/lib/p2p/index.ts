/**
 * Piper P2P Sync — TypeScript frontend bridge.
 *
 * Wraps Tauri commands for the iroh-based P2P sync service.
 * Provides React hooks and a typed API surface.
 */

import { invoke } from "@tauri-apps/api/core";

// ---------------------------------------------------------------------------
// Types (mirror Rust protocol types)
// ---------------------------------------------------------------------------

export interface PeerId {
  id: string;
}

export interface SyncScope {
  workspace_id: string;
  backend_id: string;
}

export type SyncServiceStatus =
  | "stopped"
  | "starting"
  | "running"
  | { error: string };

export interface PeerInfo {
  peer_id: string;
  device_name: string;
  scopes: SyncScope[];
  connected_at: string;
  last_seen: string;
  online: boolean;
}

export interface SyncFilter {
  workspace_ids: string[];
  backend_ids: string[];
  max_ops_per_round: number;
  sync_completed: boolean;
}

export interface SyncConflict {
  scope: SyncScope;
  entity_id: string;
  entity_type: string;
  field: string;
  local_value: unknown;
  remote_value: unknown;
  local_timestamp: string;
  remote_timestamp: string;
  local_author: string;
  remote_author: string;
}

export interface SyncRoundResult {
  scope: SyncScope;
  pulled: number;
  pushed: number;
  conflicts: SyncConflict[];
  errors: string[];
  duration_ms: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

/** Start the P2P sync service. Returns the local peer ID. */
export async function startP2PSync(): Promise<string> {
  return invoke<string>("cmd_p2p_start");
}

/** Stop the P2P sync service. */
export async function stopP2PSync(): Promise<void> {
  return invoke("cmd_p2p_stop");
}

/** Get the current sync service status. */
export async function getP2PStatus(): Promise<SyncServiceStatus> {
  return invoke<SyncServiceStatus>("cmd_p2p_status");
}

/** Get this peer's ID. */
export async function getLocalPeerId(): Promise<string | null> {
  return invoke<string | null>("cmd_p2p_peer_id");
}

/** List all known peers. */
export async function listPeers(): Promise<PeerInfo[]> {
  return invoke<PeerInfo[]>("cmd_p2p_list_peers");
}

/** Get the invite code for sharing with other peers. */
export async function getInviteCode(): Promise<string | null> {
  return invoke<string | null>("cmd_p2p_invite_code");
}

/** Update the sync filter. */
export async function setSyncFilter(filter: SyncFilter): Promise<void> {
  return invoke("cmd_p2p_set_filter", { filter });
}

/** Get the current sync filter. */
export async function getSyncFilter(): Promise<SyncFilter> {
  return invoke<SyncFilter>("cmd_p2p_get_filter");
}
