
use std::sync::Arc;
use axum::{extract::State, Json};
use crate::{db, error::AppError, handler::auth::{AuthPayload, AuthUser}, state::AppState};


pub async fn get_users_list(
    State(state): State<Arc<AppState>>,
    AuthUser(user): AuthUser,
) -> Result<Json<Vec<crate::db::models::User>>, AppError> {
    let users = db::repository::get_all_users(&state.pool)?;
    Ok(Json(users))
}