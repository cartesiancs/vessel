use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{
    db::{self, models::{Flow, FlowVersion, NewFlow, NewFlowVersion}}, error::AppError, handler::auth::{AuthUser}, state::AppState
};


#[derive(Deserialize)]
pub struct FlowPayload {
    pub name: String,
    pub description: Option<String>,
    pub enabled: Option<i32>,
}

#[derive(Deserialize)]
pub struct FlowVersionPayload {
    pub graph_json: String,
    pub comment: Option<String>,
}

pub async fn get_all_flows(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Vec<Flow>>, AppError> {
    let flows = db::repository::get_all_flows(&state.pool)?;
    Ok(Json(flows))
}


pub async fn create_flow(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<FlowPayload>,
) -> Result<Json<Flow>, AppError> {
    let new_flow = NewFlow {
        name: &payload.name,
        description: payload.description.as_deref(),
        enabled: payload.enabled,
    };
    let flow = db::repository::create_flow(&state.pool, new_flow)?;
    Ok(Json(flow))
}

pub async fn update_flow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<FlowPayload>,
) -> Result<Json<Value>, AppError> {
    let updated_flow = NewFlow {
        name: &payload.name,
        description: payload.description.as_deref(),
        enabled: payload.enabled,
    };
    db::repository::update_flow(&state.pool, id, &updated_flow)?;
    Ok(Json(json!({ "status": "success", "message": "Flow updated successfully" })))
}


pub async fn delete_flow(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Value>, AppError> {
    db::repository::delete_flow(&state.pool, id)?;
    Ok(Json(json!({ "status": "success", "message": "Flow deleted" })))
}




pub async fn create_flow_version(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(flow_id): Path<i32>,
    Json(payload): Json<FlowVersionPayload>,
) -> Result<Json<FlowVersion>, AppError> {
    let new_version_data = NewFlowVersion {
        flow_id,
        version: 1, 
        graph_json: &payload.graph_json,
        comment: payload.comment.as_deref(),
    };

    let version = db::repository::overwrite_flow_version(&state.pool, flow_id, new_version_data)?;
    Ok(Json(version))
}
pub async fn get_flow_versions(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(flow_id): Path<i32>,
) -> Result<Json<Vec<FlowVersion>>, AppError> {
    let versions = db::repository::get_versions_for_flow(&state.pool, flow_id)?;
    Ok(Json(versions))
}

