use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{db::{self, models::{Entity, NewEntity}}, error::AppError, state::AppState};

#[derive(Deserialize)]
pub struct EntityPayload {
    pub entity_id: String,
    pub device_id: Option<i32>,
    pub friendly_name: Option<String>,
    pub platform: Option<String>,
}

pub async fn create_entity(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<EntityPayload>,
) -> Result<Json<Entity>, AppError> {
    let new_entity = NewEntity {
        entity_id: &payload.entity_id,
        device_id: payload.device_id,
        friendly_name: payload.friendly_name.as_deref(),
        platform: payload.platform.as_deref(),
    };
    let entity = db::repository::create_entity(&state.pool, new_entity)?;
    Ok(Json(entity))
}

pub async fn get_entities(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<Entity>>, AppError> {
    let entities = db::repository::get_all_entities(&state.pool)?;
    Ok(Json(entities))
}

pub async fn update_entity(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    Json(payload): Json<EntityPayload>,
) -> Result<Json<Entity>, AppError> {
    let updated_entity = NewEntity {
        entity_id: &payload.entity_id,
        device_id: payload.device_id,
        friendly_name: payload.friendly_name.as_deref(),
        platform: payload.platform.as_deref(),
    };
    let entity = db::repository::update_entity(&state.pool, id, &updated_entity)?;
    Ok(Json(entity))
}

pub async fn delete_entity(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    db::repository::delete_entity(&state.pool, id)?;
    Ok(Json(json!({ "status": "success", "message": "Entity deleted" })))
}