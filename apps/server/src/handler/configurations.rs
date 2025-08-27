use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{db::{self, models::{NewSystemConfiguration, SystemConfiguration}}, error::AppError, handler::auth::AuthUser, state::AppState};

#[derive(Deserialize)]
pub struct SystemConfigPayload {
    pub key: String,
    pub value: String,
    pub enabled: Option<i32>,
    pub description: Option<String>,
}

pub async fn create_config(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<SystemConfigPayload>,
) -> Result<Json<SystemConfiguration>, AppError> {
    let new_config = NewSystemConfiguration {
        key: &payload.key,
        value: &payload.value,
        enabled: payload.enabled,
        description: payload.description.as_deref(),
    };
    let config = db::repository::create_system_config(&state.pool, new_config)?;
    Ok(Json(config))
}

pub async fn get_configs(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Vec<SystemConfiguration>>, AppError> {
    let configs = db::repository::get_all_system_configs(&state.pool)?;
    Ok(Json(configs))
}

pub async fn update_config(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<SystemConfigPayload>,
) -> Result<Json<SystemConfiguration>, AppError> {
    let updated_config = NewSystemConfiguration {
        key: &payload.key,
        value: &payload.value,
        enabled: payload.enabled,
        description: payload.description.as_deref(),
    };
    let config = db::repository::update_system_config(&state.pool, id, &updated_config)?;
    Ok(Json(config))
}

pub async fn delete_config(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    db::repository::delete_system_config(&state.pool, id)?;
    Ok(Json(json!({ "status": "success", "message": "System configuration deleted" })))
}
