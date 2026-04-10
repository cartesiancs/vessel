use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tracing::error;

use crate::{
    db::repository::set_entity_state,
    handler::auth::DeviceTokenAuth,
    state::{AppState, Protocol},
};

#[derive(Deserialize)]
pub struct StateRequest {
    pub state: String,
}

#[derive(Serialize)]
pub struct StateResponse {
    status: String,
}

pub async fn set_state(
    State(state): State<Arc<AppState>>,
    Path(topic): Path<String>,
    DeviceTokenAuth { device: auth }: DeviceTokenAuth,
    Json(payload): Json<StateRequest>,
) -> impl IntoResponse {
    let topic_map = state.topic_map.read().await;
    let matched = topic_map
        .iter()
        .find(|m| m.protocol == Protocol::Http && m.topic == topic);

    if let Some(mapping) = matched {
        if let Ok(s) = set_entity_state(&state.pool, &mapping.entity_id, &payload.state, None) {
            let ws_message = json!({
                "type": "change_state",
                "payload": {
                    "entity_id": mapping.entity_id,
                    "state": s.clone()
                }
            });
            if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                if state.broadcast_tx.send(payload_str).is_err() {
                    error!("Failed to broadcast state change.");
                }
            }
        } else {
            error!("Failed to set entity state for '{}'", mapping.entity_id);
        }
    }

    (
        StatusCode::OK,
        Json(StateResponse {
            status: "true".to_string(),
        }),
    )
}
