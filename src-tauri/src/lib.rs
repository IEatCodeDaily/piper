mod p2p;

use std::sync::Arc;
use tokio::sync::RwLock;

use p2p::{SyncService, SyncServiceConfig};

/// Managed state for the P2P sync service.
struct P2PState(Arc<RwLock<Option<SyncService>>>);

#[tauri::command]
async fn cmd_p2p_start(state: tauri::State<'_, P2PState>) -> Result<String, String> {
    let config = SyncServiceConfig::default();
    let service = SyncService::new(config);
    service.start().await?;

    let peer_id = service.get_local_peer_id().await
        .map(|p| p.to_string())
        .unwrap_or_default();

    let mut guard = state.0.write().await;
    *guard = Some(service);

    Ok(peer_id)
}

#[tauri::command]
async fn cmd_p2p_stop(state: tauri::State<'_, P2PState>) -> Result<(), String> {
    let mut guard = state.0.write().await;
    if let Some(service) = guard.take() {
        service.stop().await?;
    }
    Ok(())
}

#[tauri::command]
async fn cmd_p2p_status(state: tauri::State<'_, P2PState>) -> Result<serde_json::Value, String> {
    let guard = state.0.read().await;
    match guard.as_ref() {
        Some(service) => {
            let status = service.get_status().await;
            Ok(serde_json::to_value(status).unwrap_or_default())
        }
        None => Ok(serde_json::json!("stopped")),
    }
}

#[tauri::command]
async fn cmd_p2p_peer_id(state: tauri::State<'_, P2PState>) -> Result<Option<String>, String> {
    let guard = state.0.read().await;
    match guard.as_ref() {
        Some(service) => Ok(service.get_local_peer_id().await.map(|p| p.to_string())),
        None => Ok(None),
    }
}

#[tauri::command]
async fn cmd_p2p_list_peers(state: tauri::State<'_, P2PState>) -> Result<serde_json::Value, String> {
    let guard = state.0.read().await;
    match guard.as_ref() {
        Some(service) => {
            let peers = service.list_peers().await;
            Ok(serde_json::to_value(peers).unwrap_or_default())
        }
        None => Ok(serde_json::json!([])),
    }
}

#[tauri::command]
async fn cmd_p2p_invite_code(state: tauri::State<'_, P2PState>) -> Result<Option<String>, String> {
    let guard = state.0.read().await;
    match guard.as_ref() {
        Some(service) => Ok(service.get_invite_code().await),
        None => Ok(None),
    }
}

#[tauri::command]
async fn cmd_p2p_set_filter(
    state: tauri::State<'_, P2PState>,
    filter: p2p::selective::SyncFilter,
) -> Result<(), String> {
    let guard = state.0.read().await;
    match guard.as_ref() {
        Some(service) => {
            service.set_filter(filter).await;
            Ok(())
        }
        None => Err("P2P service is not running".into()),
    }
}

#[tauri::command]
async fn cmd_p2p_get_filter(state: tauri::State<'_, P2PState>) -> Result<serde_json::Value, String> {
    let guard = state.0.read().await;
    match guard.as_ref() {
        Some(service) => {
            let filter = service.get_filter().await;
            Ok(serde_json::to_value(filter).unwrap_or_default())
        }
        None => Err("P2P service is not running".into()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let p2p_state = P2PState(Arc::new(RwLock::new(None)));

    tauri::Builder::default()
        .manage(p2p_state)
        .invoke_handler(tauri::generate_handler![
            cmd_p2p_start,
            cmd_p2p_stop,
            cmd_p2p_status,
            cmd_p2p_peer_id,
            cmd_p2p_list_peers,
            cmd_p2p_invite_code,
            cmd_p2p_set_filter,
            cmd_p2p_get_filter,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Piper application");
}
