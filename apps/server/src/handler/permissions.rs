use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use std::sync::Arc;

use crate::{
    db::{
        self,
        models::{NewPermission, Permission},
    },
    error::AppError,
    handler::auth::AuthUser,
    state::AppState,
};

#[derive(Deserialize)]
pub struct PermissionPayload {
    name: String,
    description: Option<String>,
}

pub async fn create_permission(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<PermissionPayload>,
) -> Result<(StatusCode, Json<Permission>), AppError> {
    let new_permission = NewPermission {
        name: &payload.name,
        description: payload.description.as_deref(),
    };
    let permission = db::repository::rbac::create_permission(&state.pool, new_permission)?;
    Ok((StatusCode::CREATED, Json(permission)))
}

pub async fn get_permissions(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Vec<Permission>>, AppError> {
    let permissions = db::repository::rbac::get_all_permissions(&state.pool)?;
    Ok(Json(permissions))
}
