use anyhow::anyhow;
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
use base64::{engine::general_purpose, Engine as _};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use tracing::{info, warn};

use crate::{
    db::{
        self,
        models::{Device, User},
        repository::get_user_by_name,
    },
    error::AppError,
    utils::hash::verify_password,
    AppState,
};

const ACCESS_TOKEN_TTL_SECS: i64 = 900; // 15 minutes
const REFRESH_TOKEN_TTL_SECS: i64 = 30 * 24 * 60 * 60; // 30 days
const REFRESH_TOKEN_BYTES: usize = 32;
const ACCESS_TOKEN_TYP: &str = "access";

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
    #[serde(default)]
    pub typ: String,
}

#[derive(Deserialize)]
pub struct RefreshPayload {
    #[serde(rename = "refreshToken")]
    refresh_token: String,
}

fn generate_refresh_token() -> String {
    let mut buf = [0u8; REFRESH_TOKEN_BYTES];
    rand::rng().fill_bytes(&mut buf);
    general_purpose::URL_SAFE_NO_PAD.encode(buf)
}

fn hash_refresh_token(raw: &str) -> String {
    let digest = Sha256::digest(raw.as_bytes());
    general_purpose::URL_SAFE_NO_PAD.encode(digest)
}

fn build_access_token(secret: &str, username: &str) -> Result<String, AuthError> {
    let claims = Claims {
        sub: username.to_string(),
        exp: (Utc::now() + Duration::seconds(ACCESS_TOKEN_TTL_SECS)).timestamp() as usize,
        typ: ACCESS_TOKEN_TYP.to_string(),
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
    .map_err(|_| AuthError::TokenCreation)
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

        if decoded.claims.typ != ACCESS_TOKEN_TYP {
            return Err(AuthError::InvalidToken);
        }

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

        let user =
            get_user_by_name(&state.pool, &claims.sub).map_err(|_| AuthError::UserNotFound)?;

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
                        let access_token = build_access_token(&state.jwt_secret, &user.username)?;

                        let family_id = uuid::Uuid::new_v4().to_string();
                        let raw_refresh = generate_refresh_token();
                        let refresh_hash = hash_refresh_token(&raw_refresh);
                        let expires_at =
                            (Utc::now() + Duration::seconds(REFRESH_TOKEN_TTL_SECS)).naive_utc();

                        db::repository::insert_refresh_token(
                            &state.pool,
                            user.id,
                            &family_id,
                            &refresh_hash,
                            expires_at,
                        )
                        .map_err(|_| AuthError::TokenCreation)?;

                        info!("Auth Success {}", user.username);

                        Ok(Json(json!({
                            "token": access_token,
                            "refreshToken": raw_refresh,
                            "expiresIn": ACCESS_TOKEN_TTL_SECS,
                        })))
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

pub async fn refresh_token(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RefreshPayload>,
) -> Result<Json<serde_json::Value>, AuthError> {
    let presented_hash = hash_refresh_token(&payload.refresh_token);

    let existing = db::repository::find_refresh_token_by_hash(&state.pool, &presented_hash)
        .map_err(|_| AuthError::InvalidToken)?
        .ok_or(AuthError::InvalidToken)?;

    // Reuse detection: an already-rotated token is being presented again.
    if existing.used_at.is_some() {
        if let Err(e) = db::repository::revoke_family(&state.pool, &existing.family_id) {
            warn!("Failed to revoke refresh token family on reuse: {}", e);
        }
        return Err(AuthError::InvalidToken);
    }

    if existing.expires_at < Utc::now().naive_utc() {
        return Err(AuthError::InvalidToken);
    }

    let user = db::repository::get_user_by_id(&state.pool, existing.user_id)
        .map_err(|_| AuthError::UserNotFound)?;

    let new_raw = generate_refresh_token();
    let new_hash = hash_refresh_token(&new_raw);
    let new_expiry = (Utc::now() + Duration::seconds(REFRESH_TOKEN_TTL_SECS)).naive_utc();

    let rotated = db::repository::rotate_refresh_token(
        &state.pool,
        existing.id,
        existing.user_id,
        &existing.family_id,
        &new_hash,
        new_expiry,
    )
    .map_err(|_| AuthError::TokenCreation)?;

    // None => the token was consumed by a concurrent request (reuse race).
    if rotated.is_none() {
        if let Err(e) = db::repository::revoke_family(&state.pool, &existing.family_id) {
            warn!("Failed to revoke refresh token family on reuse race: {}", e);
        }
        return Err(AuthError::InvalidToken);
    }

    let access_token = build_access_token(&state.jwt_secret, &user.username)?;

    Ok(Json(json!({
        "token": access_token,
        "refreshToken": new_raw,
        "expiresIn": ACCESS_TOKEN_TTL_SECS,
    })))
}

pub async fn logout(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<RefreshPayload>,
) -> Result<Json<serde_json::Value>, AuthError> {
    let presented_hash = hash_refresh_token(&payload.refresh_token);

    // Idempotent: unknown tokens still return success so logout never leaks
    // whether a token was valid.
    if let Ok(Some(existing)) =
        db::repository::find_refresh_token_by_hash(&state.pool, &presented_hash)
    {
        if let Err(e) = db::repository::revoke_family(&state.pool, &existing.family_id) {
            warn!("Failed to revoke refresh token family on logout: {}", e);
        }
    }

    Ok(Json(json!({ "status": "success" })))
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

            let token_valid = verify_password(&token_clone, &token_info.token_hash)?;

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
