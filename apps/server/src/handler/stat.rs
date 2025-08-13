use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{db::{self, models::{EntityWithConfig, NewEntity}}, error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct EntityPayload {
    pub entity_id: String,
    pub device_id: Option<i32>,
    pub friendly_name: Option<String>,
    pub platform: Option<String>,
    pub configuration: Option<Value>,
}


pub async fn get_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let entities = db::repository::get_all_entities(&state.pool)?;
    let devices = db::repository::get_all_devices(&state.pool)?;


    Ok(Json(json!({
        "count": {
            "entities": entities.len(),
            "devices": devices.len()
        },
    })))
}

