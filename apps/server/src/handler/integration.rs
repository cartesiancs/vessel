use anyhow::anyhow;
use axum::{
    extract::{Path, State},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{
    db,
    error::AppError,
    handler::auth::AuthUser,
    state::AppState,
};

#[derive(Deserialize)]
pub struct IntegrationRegisterPayload {
    pub integration_id: String,
    pub config: Value,
}

pub async fn register_integration(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<IntegrationRegisterPayload>,
) -> Result<Json<Value>, AppError> {
    match payload.integration_id.as_str() {
        "home_assistant" => {
            let url = payload
                .config
                .get("url")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("Missing 'url' in config"))?;
            let token = payload
                .config
                .get("token")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("Missing 'token' in config"))?;

            let device =
                db::repository::upsert_device(&state.pool, "home_assistant", Some("Home Assistant"), Some("Home Assistant"), None)?;

            db::repository::upsert_entity_with_config(
                &state.pool,
                "home_assistant.bridge",
                Some(device.id),
                Some("Home Assistant Bridge"),
                Some("home_assistant"),
                Some("bridge"),
                &json!({ "url": url, "token": token }).to_string(),
            )?;

            Ok(Json(json!({ "status": "success", "integration_id": "home_assistant" })))
        }
        "ros2" => {
            let ws_url = payload
                .config
                .get("websocket_url")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("Missing 'websocket_url' in config"))?;

            let device =
                db::repository::upsert_device(&state.pool, "ros2_bridge", Some("ROS2 Bridge"), Some("Open Robotics"), None)?;

            db::repository::upsert_entity_with_config(
                &state.pool,
                "ros2.bridge",
                Some(device.id),
                Some("ROS2 WebSocket Bridge"),
                Some("ros2"),
                Some("bridge"),
                &json!({ "websocket_url": ws_url }).to_string(),
            )?;

            Ok(Json(json!({ "status": "success", "integration_id": "ros2" })))
        }
        other => Err(anyhow!("Unknown integration_id: {}", other).into()),
    }
}

pub async fn get_integration_status(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Value>, AppError> {
    let ha = db::repository::get_entity_with_config_by_entity_id(
        &state.pool,
        "home_assistant.bridge",
    )?;
    let ros2 = db::repository::get_entity_with_config_by_entity_id(
        &state.pool,
        "ros2.bridge",
    )?;

    let ha_connected = ha.is_some();
    let ros2_connected = ros2.is_some();

    Ok(Json(json!({
        "home_assistant": { "connected": ha_connected },
        "ros2": { "connected": ros2_connected }
    })))
}

pub async fn delete_integration(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(integration_id): Path<String>,
) -> Result<Json<Value>, AppError> {
    match integration_id.as_str() {
        "home_assistant" => {
            db::repository::delete_device_by_device_id(&state.pool, "home_assistant")?;
            Ok(Json(json!({ "status": "success", "message": "Home Assistant integration removed" })))
        }
        "ros2" => {
            db::repository::delete_device_by_device_id(&state.pool, "ros2_bridge")?;
            Ok(Json(json!({ "status": "success", "message": "ROS2 integration removed" })))
        }
        other => Err(anyhow!("Unknown integration_id: {}", other).into()),
    }
}
