use crate::{
    db::{
        self,
        models::{CustomNodeResult, NewCustomNode, UpdateCustomNode},
    },
    error::AppError,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct CreateCustomNodePayload {
    pub node_type: String,
    pub data: Option<Value>,
}

pub async fn create_custom_node_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateCustomNodePayload>,
) -> Result<(StatusCode, Json<db::models::CustomNode>), AppError> {
    let data_str = payload
        .data
        .map(|v| {
            if v.is_null() || v.as_object().map_or(false, |m| m.is_empty()) {
                String::new()
            } else {
                serde_json::to_string(&v).unwrap_or_default()
            }
        })
        .unwrap_or_default();

    let new_node = NewCustomNode {
        node_type: &payload.node_type,
        data: &data_str,
    };

    let node = db::repository::create_custom_node(&state.pool, &new_node)?;
    Ok((StatusCode::CREATED, Json(node)))
}

pub async fn get_all_custom_nodes_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CustomNodeResult>>, AppError> {
    let nodes = db::repository::get_all_custom_nodes(&state.pool)?;
    Ok(Json(nodes))
}

pub async fn get_custom_node_handler(
    State(state): State<Arc<AppState>>,
    Path(node_type): Path<String>,
) -> Result<Json<db::models::CustomNode>, AppError> {
    let node = db::repository::get_custom_node(&state.pool, &node_type)?;
    Ok(Json(node))
}

#[derive(Deserialize)]
pub struct UpdateCustomNodePayload {
    pub data: Option<Value>,
}

pub async fn update_custom_node_handler(
    State(state): State<Arc<AppState>>,
    Path(node_type): Path<String>,
    Json(payload): Json<UpdateCustomNodePayload>,
) -> Result<Json<CustomNodeResult>, AppError> {
    let data_str = payload
        .data
        .map(|v| {
            if v.is_null() || v.as_object().map_or(false, |m| m.is_empty()) {
                String::new()
            } else {
                v.to_string()
            }
        })
        .unwrap_or_default();

    let update_data = UpdateCustomNode {
        data: Some(data_str),
    };

    let updated_node = db::repository::update_custom_node(&state.pool, &node_type, &update_data)?;
    Ok(Json(updated_node))
}

pub async fn delete_custom_node_handler(
    State(state): State<Arc<AppState>>,
    Path(node_type): Path<String>,
) -> Result<StatusCode, AppError> {
    db::repository::delete_custom_node(&state.pool, &node_type)?;
    Ok(StatusCode::NO_CONTENT)
}
