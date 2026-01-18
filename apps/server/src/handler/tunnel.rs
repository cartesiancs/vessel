use std::sync::Arc;

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};

use crate::{state::AppState, tunnel_control::TunnelManager};

#[derive(Deserialize)]
pub struct StartRequest {
    pub server: String,
    pub target: String,
}

#[derive(Serialize)]
pub struct StartResponse {
    pub session_id: String,
}

#[derive(Serialize)]
pub struct StatusResponse {
    pub active: bool,
    pub session_id: Option<String>,
    pub server: Option<String>,
    pub target: Option<String>,
}

pub async fn start_tunnel(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<StartRequest>,
) -> Result<Json<StartResponse>, StatusCode> {
    let session_id = state
        .tunnel_manager
        .start(payload.server, payload.target)
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    Ok(Json(StartResponse { session_id }))
}

pub async fn stop_tunnel(State(state): State<Arc<AppState>>) -> Result<StatusCode, StatusCode> {
    state
        .tunnel_manager
        .stop()
        .await
        .map_err(|_| StatusCode::BAD_GATEWAY)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn status_tunnel(State(state): State<Arc<AppState>>) -> Json<StatusResponse> {
    let status = state.tunnel_manager.status().await;
    Json(StatusResponse {
        active: status.active,
        session_id: status.session_id,
        server: status.server,
        target: status.target,
    })
}
