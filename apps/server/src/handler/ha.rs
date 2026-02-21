use anyhow::anyhow;
use axum::{
    extract::{Path, State},
    Json,
};
use reqwest::header;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;

use crate::{db, error::AppError, handler::auth::AuthUser, state::{AppState, DbPool}};

#[derive(Serialize, Deserialize, Debug)]
pub struct HaState {
    pub entity_id: String,
    pub state: String,
    pub attributes: Value,
    pub last_changed: String,
    pub last_updated: String,
    pub context: Value,
}

fn get_ha_credentials(pool: &DbPool) -> Result<(String, String), anyhow::Error> {
    let entity_with_config =
        db::repository::get_entity_with_config_by_entity_id(pool, "home_assistant.bridge")?
            .ok_or_else(|| anyhow!("Home Assistant is not configured. Please register the integration first."))?;

    let config = entity_with_config
        .configuration
        .ok_or_else(|| anyhow!("Home Assistant bridge entity has no configuration."))?;

    let url = config
        .get("url")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("Home Assistant URL is not configured."))?;
    let token = config
        .get("token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!("Home Assistant Token is not configured."))?;

    Ok((url.to_string(), token.to_string()))
}

pub async fn get_all_states(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Vec<HaState>>, AppError> {
    let (ha_url, ha_token) = get_ha_credentials(&state.pool)?;

    let api_url = format!("{}/api/states", ha_url.trim_end_matches('/'));

    let client = reqwest::Client::new();
    let response = client
        .get(&api_url)
        .header(header::AUTHORIZATION, format!("Bearer {}", ha_token))
        .header(header::CONTENT_TYPE, "application/json")
        .send()
        .await?;

    let status = response.status();

    if status.is_success() {
        let states = response.json::<Vec<HaState>>().await?;
        Ok(Json(states))
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not read error body".to_string());

        let err = anyhow!(
            "Home Assistant returned an error. Status: {}, Body: {}",
            status,
            error_text
        );

        return Err(err.into());
    }
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HaStateUpdatePayload {
    pub state: String,
    pub attributes: Option<Value>,
}

pub async fn post_state(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(entity_id): Path<String>,
    Json(payload): Json<HaStateUpdatePayload>,
) -> Result<Json<HaState>, AppError> {
    let (ha_url, ha_token) = get_ha_credentials(&state.pool)?;

    let api_url = format!("{}/api/states/{}", ha_url.trim_end_matches('/'), entity_id);

    let mut ha_body = json!({ "state": payload.state });
    if let Some(attributes) = payload.attributes {
        if let Some(obj) = ha_body.as_object_mut() {
            obj.insert("attributes".to_string(), attributes);
        }
    }

    let client = reqwest::Client::new();
    let response = client
        .post(&api_url)
        .header(header::AUTHORIZATION, format!("Bearer {}", ha_token))
        .header(header::CONTENT_TYPE, "application/json")
        .json(&ha_body)
        .send()
        .await?;

    let status = response.status();

    if status.is_success() {
        let new_state = response.json::<HaState>().await?;
        Ok(Json(new_state))
    } else {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Could not read error body".to_string());

        let err = anyhow!(
            "Home Assistant returned an error. Status: {}, Body: {}",
            status,
            error_text
        );

        return Err(err.into());
    }
}
