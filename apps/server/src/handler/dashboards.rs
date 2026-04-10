use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{db, error::AppError, state::AppState};

#[derive(Serialize)]
pub struct DynamicDashboardResponse {
    pub id: String,
    pub name: String,
    pub layout: Value,
    pub created_at: String,
    pub updated_at: String,
}

impl From<db::models::DynamicDashboard> for DynamicDashboardResponse {
    fn from(model: db::models::DynamicDashboard) -> Self {
        let layout_value: Value =
            serde_json::from_str(&model.layout).unwrap_or_else(|_| Value::Null);

        DynamicDashboardResponse {
            id: model.id,
            name: model.name,
            layout: layout_value,
            created_at: model.created_at.to_string(),
            updated_at: model.updated_at.to_string(),
        }
    }
}

#[derive(Deserialize)]
pub struct CreateDashboardPayload {
    pub name: String,
    pub layout: Value,
}

#[derive(Deserialize)]
pub struct UpdateDashboardPayload {
    pub name: Option<String>,
    pub layout: Option<Value>,
}

pub async fn list_dashboards(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<DynamicDashboardResponse>>, AppError> {
    let dashboards = db::repository::dashboards::list_dynamic_dashboards(&state.pool)?
        .into_iter()
        .map(DynamicDashboardResponse::from)
        .collect();

    Ok(Json(dashboards))
}

pub async fn create_dashboard(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateDashboardPayload>,
) -> Result<(StatusCode, Json<DynamicDashboardResponse>), AppError> {
    let dashboard = db::repository::dashboards::create_dynamic_dashboard(
        &state.pool,
        &payload.name,
        &payload.layout,
    )?;

    Ok((StatusCode::CREATED, Json(dashboard.into())))
}

pub async fn get_dashboard(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let dashboard = db::repository::dashboards::get_dynamic_dashboard(&state.pool, &id)?;

    match dashboard {
        Some(d) => Ok(Json(DynamicDashboardResponse::from(d)).into_response()),
        None => Ok((StatusCode::NOT_FOUND, "Dashboard not found").into_response()),
    }
}

pub async fn update_dashboard(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateDashboardPayload>,
) -> Result<impl IntoResponse, AppError> {
    let dashboard = db::repository::dashboards::update_dynamic_dashboard(
        &state.pool,
        &id,
        payload.name.as_deref(),
        payload.layout.as_ref(),
    )?;

    match dashboard {
        Some(d) => Ok(Json(DynamicDashboardResponse::from(d)).into_response()),
        None => Ok((StatusCode::NOT_FOUND, "Dashboard not found").into_response()),
    }
}

pub async fn delete_dashboard(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    let deleted = db::repository::dashboards::delete_dynamic_dashboard(&state.pool, &id)?;

    if deleted == 0 {
        return Ok((StatusCode::NOT_FOUND, "Dashboard not found").into_response());
    }

    Ok(StatusCode::NO_CONTENT.into_response())
}
