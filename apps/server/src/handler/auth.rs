use async_trait::async_trait;
use axum::{
    extract::{FromRef, FromRequestParts, State},
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json, RequestPartsExt,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::info;
use std::sync::Arc;
use anyhow::anyhow;

use crate::{
    db::{
        self, models::{Device, User}, repository::{self, get_user_by_name}
    },  hash::{self, verify_password}, AppState, error::AppError
};

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub status: &'static str,
    pub message: String,
}

#[derive(Deserialize)]
pub struct AuthPayload {
    id: String,
    password: String,
}

#[derive(Debug)]
pub enum AuthError {
    WrongCredentials,
    MissingCredentials,
    TokenCreation,
    InvalidToken,
    UserNotFound, 
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, error_message) = match self {
            AuthError::WrongCredentials => (StatusCode::UNAUTHORIZED, "Wrong credentials"),
            AuthError::MissingCredentials => (StatusCode::BAD_REQUEST, "Missing credentials"),
            AuthError::TokenCreation => (StatusCode::INTERNAL_SERVER_ERROR, "Token creation error"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid token"),
            AuthError::UserNotFound => (StatusCode::UNAUTHORIZED, "User not found"),
        };
        let body = Json(json!({
            "status": "error",
            "message": error_message,
        }));
        (status, body).into_response()
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

pub struct JwtAuth(pub Claims);

#[async_trait]
impl<S> FromRequestParts<S> for JwtAuth
where
    S: Send + Sync,
    Arc<AppState>: FromRef<S>,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let state = Arc::<AppState>::from_ref(state);

        let token = if let Some(token) = get_token_from_header(parts).await {
            token
        } else {
            get_token_from_query(parts)
                .await
                .ok_or(AuthError::MissingCredentials)?
        };

        let decoding_key = DecodingKey::from_secret(state.jwt_secret.as_ref());
        let validation = Validation::default();

        let decoded = decode::<Claims>(&token, &decoding_key, &validation)
            .map_err(|_| AuthError::InvalidToken)?;

        Ok(JwtAuth(decoded.claims))
    }
}

pub struct AuthUser(pub User);

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
    Arc<AppState>: FromRef<S>,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let claims = JwtAuth::from_request_parts(parts, state).await?.0;
        
        let state = Arc::<AppState>::from_ref(state);

        let user = get_user_by_name(&state.pool, &claims.sub)
            .map_err(|_| AuthError::UserNotFound)?;

        Ok(AuthUser(user))
    }
}



async fn get_token_from_header(parts: &mut Parts) -> Option<String> {
    parts
        .extract::<TypedHeader<Authorization<Bearer>>>()
        .await
        .map(|TypedHeader(Authorization(bearer))| bearer.token().to_string())
        .ok()
}

async fn get_token_from_query(parts: &mut Parts) -> Option<String> {
    #[derive(Deserialize)]
    struct QueryParams {
        token: String,
    }
    
    parts
        .extract::<axum::extract::Query<QueryParams>>()
        .await
        .map(|query| query.0.token)
        .ok()
}

pub async fn auth_with_password(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AuthPayload>,
) -> Result<Json<serde_json::Value>, AuthError> {
    match get_user_by_name(&state.pool, &payload.id) {
        Ok(user) => {
            let login_attempt_password = &payload.password.clone();
            let stored_hash = &user.password_hash;
            info!("auth_with_password");

            match verify_password(login_attempt_password, stored_hash) {
                Ok(is_valid) => {
                    if is_valid {
                        let claims = Claims {
                            sub: payload.id,
                            exp: (chrono::Utc::now() + chrono::Duration::hours(1)).timestamp() as usize,
                        };

                        let token = jsonwebtoken::encode(
                            &jsonwebtoken::Header::default(),
                            &claims,
                            &jsonwebtoken::EncodingKey::from_secret(state.jwt_secret.as_ref()),
                        )
                        .map_err(|_| AuthError::TokenCreation)?;

                        info!("Auth Success {}", claims.sub);

                        Ok(Json(json!({ "token": token })))
                    } else {
                        Err(AuthError::WrongCredentials)
                    }
                }
                Err(_) => Err(AuthError::WrongCredentials),
            }
        }
        Err(_) => Err(AuthError::UserNotFound),
    }
}



pub struct DeviceTokenAuth {
    pub device: Device,
}

#[async_trait]
impl FromRequestParts<Arc<AppState>> for DeviceTokenAuth {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &Arc<AppState>,
    ) -> Result<Self, Self::Rejection> {
        let TypedHeader(Authorization(bearer)) =
            TypedHeader::<Authorization<Bearer>>::from_request_parts(parts, state)
                .await
                .map_err(|_| anyhow!("Missing or invalid authorization header"))?;

        let device_id_header = parts
            .headers
            .get("X-Device-Id")
            .and_then(|value| value.to_str().ok())
            .ok_or_else(|| anyhow!("Missing X-Device-Id header"))?;

        let pool = state.pool.clone();
        let device_id_clone = device_id_header.to_string();
        let token_clone = bearer.token().to_string();

        let device = tokio::task::spawn_blocking(move || {
            let device = db::repository::get_device_by_device_id(&pool, &device_id_clone)?;

            let token_info = db::repository::get_token_info_for_device(&pool, device.id)?
                .ok_or_else(|| anyhow!("No active token for this device"))?;

            let token_valid = hash::verify_password(&token_clone, &token_info.token_hash)?;

            if token_valid {
                Ok(device)
            } else {
                Err(anyhow!("Invalid token"))
            }
        })
        .await
        .map_err(|e| anyhow!("Task execution error: {}", e))??;

        Ok(DeviceTokenAuth { device })
    }
}