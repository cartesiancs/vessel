use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde_json::{json, Value};
use crate::{db, error::AppError, state::AppState, hash};
use rand::{RngCore, thread_rng};
use base64::{engine::general_purpose, Engine as _};

fn generate_api_key() -> String {
    let mut key = [0u8; 32];
    thread_rng().fill_bytes(&mut key);
    general_purpose::URL_SAFE_NO_PAD.encode(key)
}

pub async fn issue_token(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let raw_token = generate_api_key();

    let token_hash = hash::hash_password(&raw_token)?;

    db::repository::create_or_replace_device_token(&state.pool, id, &token_hash)?;
    
    Ok(Json(json!({
        "message": "New device token generated successfully. Store this token securely, it will not be shown again.",
        "token": raw_token
    })))
}

pub async fn get_token_info(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    let token_info = db::repository::get_token_info_for_device(&state.pool, id)?;
    
    match token_info {
        Some(info) => Ok(Json(serde_json::to_value(info)?)),
        None => Ok(Json(json!({ "message": "No token found for this device." })))
    }
}

pub async fn revoke_token(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    db::repository::delete_token_for_device(&state.pool, id)?;
    Ok(Json(json!({ "status": "success", "message": "Device token has been revoked." })))
}
