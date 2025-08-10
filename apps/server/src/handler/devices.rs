use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::{db::{self, models::{Device, NewDevice}}, error::AppError, handler::auth::AuthUser, state::AppState};

#[derive(Deserialize)]
pub struct DevicePayload {
    pub device_id: String,
    pub name: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
}

pub async fn create_device(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<DevicePayload>,
) -> Result<Json<crate::db::models::Device>, AppError> {
    let new_device = NewDevice {
        device_id: &payload.device_id,
        name: payload.name.as_deref(),
        manufacturer: payload.manufacturer.as_deref(),
        model: payload.model.as_deref(),
    };
    let device = db::repository::create_device(&state.pool, new_device)?;
    Ok(Json(device))
}

pub async fn get_devices(
    State(state): State<Arc<AppState>>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<crate::db::models::Device>>, AppError> {
    let devices = db::repository::get_all_devices(&state.pool)?;
    Ok(Json(devices))
}

pub async fn update_device(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    Json(payload): Json<DevicePayload>,
) ->  Result<Json<crate::db::models::Device>, AppError> {
    let updated_device = NewDevice {
        device_id: &payload.device_id,
        name: payload.name.as_deref(),
        manufacturer: payload.manufacturer.as_deref(),
        model: payload.model.as_deref(),
    };
    let device = db::repository::update_device(&state.pool, id, &updated_device)?;
    Ok(Json(device))
}

pub async fn delete_device(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    db::repository::delete_device(&state.pool, id)?;
    Ok(Json(json!({ "status": "success", "message": "Device deleted" })))
}