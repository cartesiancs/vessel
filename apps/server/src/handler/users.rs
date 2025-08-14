
use std::sync::Arc;
use axum::{extract::{Path, State}, http::StatusCode, Json};
use serde::Deserialize;
use serde_json::json;
use crate::{db::{self, models::{NewUser, UpdateUser}, repository}, error::AppError, handler::auth::{AuthPayload, AuthUser}, hash::hash_password, state::AppState};


#[derive(Deserialize)]
pub struct CreateUserPayload {
    pub username: String,
    pub email: String,
    pub password: String,
}


pub async fn get_users_list(
    State(state): State<Arc<AppState>>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<crate::db::models::User>>, AppError> {
    let users = db::repository::get_all_users(&state.pool)?;
    Ok(Json(users))
}


pub async fn create_user(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateUserPayload>,
) -> Result<(StatusCode, Json<crate::db::models::User>), AppError> {

    let hashed_password = hash_password(&payload.password)?;

    let new_user = NewUser {
        username: &payload.username,
        email: &payload.email,
        password_hash: &hashed_password,
    };

    let user = repository::create_user(&state.pool, new_user)?;

    Ok((StatusCode::CREATED, Json(user)))

}

pub async fn get_user(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(user_id): Path<i32>,
) -> Result<Json<crate::db::models::User>, AppError> {
    let user = repository::get_user_by_id(&state.pool, user_id)?;
    Ok(Json(user))
}


#[derive(Deserialize, Default)]
pub struct UpdateUserPayload {
    pub username: Option<String>,
    pub email: Option<String>,
    pub password: Option<String>,
}

pub async fn update_user(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(user_id): Path<i32>,
    Json(payload): Json<UpdateUserPayload>,
) -> Result<Json<crate::db::models::User>, AppError> {
    let password_hash = payload.password.map(|p| format!("hashed_{}", p));

    let user_data = UpdateUser {
        username: payload.username,
        email: payload.email,
        password_hash,
    };

    let updated_user = repository::update_user(&state.pool, user_id, &user_data)?;
    Ok(Json(updated_user))
}


pub async fn delete_user(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(user_id): Path<i32>,
) -> Result<StatusCode, AppError> {
    repository::delete_user(&state.pool, user_id)?;
    Ok(StatusCode::NO_CONTENT)
}