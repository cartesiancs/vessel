use std::sync::Arc;
use axum::{extract::{State}, Json};
use serde_json::{json};
use crate::{db::{self}, error::AppError, handler::auth::AuthUser, lib::entity_map::remap_topics, state::AppState};



pub async fn get_stats(
    AuthUser(_user): AuthUser,
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let entities = db::repository::get_all_entities(&state.pool)?;
    let devices = db::repository::get_all_devices(&state.pool)?;

    remap_topics(State(state)).await?;

    Ok(Json(json!({
        "count": {
            "entities": entities.len(),
            "devices": devices.len()
        },
    })))
}

