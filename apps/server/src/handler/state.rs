
use axum::{extract::{Path, State}, http::StatusCode, response::IntoResponse, Json};
use rand::Rng;
use rtp::packet::Packet;
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use std::sync::Arc;
use tokio::{sync::{broadcast, RwLock}, time::Instant};

use crate::{
    db::{models::Entity, repository::{get_entity_by_entity_id, set_entity_state}}, handler::auth::DeviceTokenAuth, state::{AppState, MediaType, StreamInfo}
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
            if let Err(e) = set_entity_state(&state.pool, &entity.entity_id, &payload.state, None) {
                error!("Failed to set entity state for '{}': {}", entity.entity_id, e);
            }
        }
    }

    (
        StatusCode::OK,
        Json(StateResponse {
            status: "true".to_string()
        }),
    )
}