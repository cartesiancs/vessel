//! Authentication extractor for protected endpoints
//!
//! Extracts and validates JWT tokens from Authorization header.
//! Returns AuthUser with user_id for downstream handlers.

use axum::{
    extract::FromRequestParts,
    http::{request::Parts, StatusCode},
    response::{IntoResponse, Response},
    Json, RequestPartsExt,
};
use axum_extra::{
    headers::{authorization::Bearer, Authorization},
    TypedHeader,
};
use std::sync::Arc;

use crate::services::{JwtError, JwtValidator, SupabaseClaims};

/// Authenticated user information
///
/// Extracted from validated JWT token.
/// Available in handlers as an extractor parameter.
#[derive(Debug, Clone)]
pub struct AuthUser {
    /// User ID (UUID) from JWT sub claim
    pub user_id: String,

    /// User email (optional)
    pub email: Option<String>,

    /// Full JWT claims for additional data
    pub claims: SupabaseClaims,
}

/// Authentication errors
#[derive(Debug)]
pub enum AuthError {
    /// No Authorization header present
    MissingToken,

    /// Token format is invalid
    InvalidToken(String),

    /// Token has expired
    Expired,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, message) = match &self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "Authorization token required"),
            AuthError::InvalidToken(msg) => {
                tracing::debug!("Invalid token: {}", msg);
                (StatusCode::UNAUTHORIZED, "Invalid authorization token")
            }
            AuthError::Expired => (StatusCode::UNAUTHORIZED, "Token expired"),
        };

        (status, Json(serde_json::json!({ "error": message }))).into_response()
    }
}

#[async_trait::async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AuthError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        // Extract Bearer token from Authorization header
        let TypedHeader(Authorization(bearer)) = parts
            .extract::<TypedHeader<Authorization<Bearer>>>()
            .await
            .map_err(|_| AuthError::MissingToken)?;

        // Get JWT validator from extensions (set by middleware layer)
        let jwt_validator = parts
            .extensions
            .get::<Arc<JwtValidator>>()
            .ok_or_else(|| AuthError::InvalidToken("JWT validator not configured".to_string()))?;

        // Validate token (async - fetches JWKS if needed)
        let claims = jwt_validator
            .validate(bearer.token())
            .await
            .map_err(|e| match e {
                JwtError::Expired => AuthError::Expired,
                _ => AuthError::InvalidToken(e.to_string()),
            })?;

        tracing::debug!(user_id = %claims.sub, "User authenticated");

        Ok(AuthUser {
            user_id: claims.sub.clone(),
            email: claims.email.clone(),
            claims,
        })
    }
}
