use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use rand::Rng;
use rtp::packet::Packet;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use tokio::{
    sync::{broadcast, RwLock},
    time::Instant,
};
use tracing::{error, info};

use crate::{
    db::{
        models::Entity,
        repository::{get_entity_by_entity_id, set_entity_state},
    },
    handler::auth::DeviceTokenAuth,
    state::{AppState, MediaType, StreamInfo},
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
    Path(entity_id): Path<String>,
    DeviceTokenAuth { device: auth }: DeviceTokenAuth,
    Json(payload): Json<StateRequest>,
) -> impl IntoResponse {
    if let Ok(entity) = get_entity_by_entity_id(&state.pool, &entity_id) {
        if entity.platform.as_deref() == Some("HTTP") {
            if let Ok(s) = set_entity_state(&state.pool, &entity.entity_id, &payload.state, None) {
                let ws_message = json!({
                    "type": "change_state",
                    "payload": s.clone()
                });
                if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                    if state.broadcast_tx.send(payload_str).is_err() {
                        error!("Failed to send health check response.");
                    }
                }
            } else {
                error!("Failed to set entity state for '{}", entity.entity_id);
            }
        }
    }

    (
        StatusCode::OK,
        Json(StateResponse {
            status: "true".to_string(),
        }),
    )
}
