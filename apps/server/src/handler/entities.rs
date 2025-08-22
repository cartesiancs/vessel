use std::sync::Arc;
use axum::{extract::{Path, Query, State}, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{db::{self, models::{EntityWithConfig, EntityWithStateAndConfig, NewEntity}}, error::AppError, lib::entity_map::remap_topics, state::AppState};

#[derive(Deserialize)]
pub struct EntityPayload {
    pub entity_id: String,
    pub device_id: Option<i32>,
    pub friendly_name: Option<String>,
    pub platform: Option<String>,
    pub entity_type: Option<String>,
    pub configuration: Option<Value>,
}

#[derive(Deserialize)]
pub struct GetEntitiesParams {
    pub entity_type: Option<String>,
}

pub async fn create_entity(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<EntityPayload>,
) -> Result<Json<EntityWithConfig>, AppError> {
    let new_entity = NewEntity {
        entity_id: &payload.entity_id,
        device_id: payload.device_id,
        friendly_name: payload.friendly_name.as_deref(),
        platform: payload.platform.as_deref(),
        entity_type: payload.entity_type.as_deref(),
    };
    
    let config_str = payload.configuration
        .map(|v| if v.is_null() || v.as_object().map_or(false, |m| m.is_empty()) {
            String::new()
        } else {
            v.to_string()
        })
        .unwrap_or_default();

    let (entity, config_opt) = db::repository::create_entity_with_config(&state.pool, new_entity, &config_str)?;

    let response = EntityWithConfig {
        entity,
        configuration: config_opt.map(|c| serde_json::from_str(&c.configuration).unwrap_or_default())
    };

    remap_topics(State(state)).await?;

    
    Ok(Json(response))
}

pub async fn get_entities(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetEntitiesParams>,
) -> Result<Json<Vec<EntityWithConfig>>, AppError> {
    let entities = db::repository::get_all_entities_with_configs_filter(&state.pool, params.entity_type)?;
    Ok(Json(entities))
}

pub async fn get_entities_with_states(
    State(state): State<Arc<AppState>>,
    Query(params): Query<GetEntitiesParams>,
) -> Result<Json<Vec<EntityWithStateAndConfig>>, AppError> {
    let entities = db::repository::get_all_entities_with_states_and_configs_filter(&state.pool, params.entity_type)?;
    Ok(Json(entities))
}


pub async fn update_entity(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    Json(payload): Json<EntityPayload>,
) -> Result<Json<EntityWithConfig>, AppError> {
    let updated_entity = NewEntity {
        entity_id: &payload.entity_id,
        device_id: payload.device_id,
        friendly_name: payload.friendly_name.as_deref(),
        platform: payload.platform.as_deref(),
        entity_type: payload.entity_type.as_deref(),
    };

    let config_str = payload.configuration
        .map(|v| if v.is_null() || v.as_object().map_or(false, |m| m.is_empty()) {
            String::new()
        } else {
            v.to_string()
        })
        .unwrap_or_default();
    
    let (entity, config_opt) = db::repository::update_entity_with_config(&state.pool, id, &updated_entity, &config_str)?;

    let response = EntityWithConfig {
        entity,
        configuration: config_opt.map(|c| serde_json::from_str(&c.configuration).unwrap_or_default())
    };

    remap_topics(State(state)).await?;

    Ok(Json(response))
}


pub async fn delete_entity(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    db::repository::delete_entity(&state.pool, id)?;
    remap_topics(State(state)).await?;

    Ok(Json(json!({ "status": "success", "message": "Entity deleted" })))
}