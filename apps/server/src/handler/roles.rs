use crate::{
    db::{
        self,
        models::{NewRole, Permission, Role},
        repository::rbac,
    },
    error::AppError,
    handler::auth::AuthUser,
    state::AppState,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct RolePayload {
    name: String,
    description: Option<String>,
    permission_ids: Vec<i32>,
}

#[derive(Deserialize)]
pub struct PermissionAssignmentPayload {
    permission_id: i32,
}

pub async fn create_role(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<RolePayload>,
) -> Result<(StatusCode, Json<Role>), AppError> {
    let role = rbac::create_role_with_permissions(
        &state.pool,
        &payload.name,
        payload.description.as_deref(),
        &payload.permission_ids,
    )?;
    Ok((StatusCode::CREATED, Json(role)))
}

pub async fn get_roles(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Vec<crate::db::models::RoleWithPermissions>>, AppError> {
    let roles = rbac::get_all_roles_with_permissions(&state.pool)?;
    Ok(Json(roles))
}

pub async fn update_role(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(role_id): Path<i32>,
    Json(payload): Json<RolePayload>,
) -> Result<Json<Role>, AppError> {
    let updated_role = rbac::update_role_with_permissions(
        &state.pool,
        role_id,
        &payload.name,
        payload.description.as_deref(),
        &payload.permission_ids,
    )?;
    Ok(Json(updated_role))
}

pub async fn delete_role(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(role_id): Path<i32>,
) -> Result<StatusCode, AppError> {
    db::repository::rbac::delete_role(&state.pool, role_id)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn grant_permission_to_role(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(role_id): Path<i32>,
    Json(payload): Json<PermissionAssignmentPayload>,
) -> Result<StatusCode, AppError> {
    db::repository::rbac::grant_permission_to_role(&state.pool, role_id, payload.permission_id)?;
    Ok(StatusCode::CREATED)
}

pub async fn revoke_permission_from_role(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path((role_id, permission_id)): Path<(i32, i32)>,
) -> Result<StatusCode, AppError> {
    db::repository::rbac::revoke_permission_from_role(&state.pool, role_id, permission_id)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn get_role_permissions(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(role_id): Path<i32>,
) -> Result<Json<Vec<Permission>>, AppError> {
    let permissions = db::repository::rbac::get_role_permissions(&state.pool, role_id)?;
    Ok(Json(permissions))
}
