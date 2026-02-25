use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Capsule error types
#[derive(Error, Debug)]
pub enum CapsuleError {
    #[error("Invalid public key format")]
    InvalidPublicKey,

    #[error("Invalid nonce format")]
    InvalidNonce,

    #[error("Invalid ciphertext format")]
    InvalidCiphertext,

    #[error("Cipher initialization failed")]
    CipherInitFailed,

    #[error("Decryption failed - invalid ciphertext or key")]
    DecryptionFailed,

    #[error("OpenAI API error: {0}")]
    OpenAIError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("Rate limit exceeded: {0}")]
    RateLimited(String),

    #[error("Subscription required")]
    SubscriptionRequired,

    #[error("History validation failed: {0}")]
    HistoryTooLarge(String),
}

impl IntoResponse for CapsuleError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            CapsuleError::InvalidPublicKey
            | CapsuleError::InvalidNonce
            | CapsuleError::InvalidCiphertext => (StatusCode::BAD_REQUEST, self.to_string()),

            CapsuleError::DecryptionFailed => {
                (StatusCode::BAD_REQUEST, "Decryption failed".to_string())
            }

            CapsuleError::CipherInitFailed | CapsuleError::Internal(_) => {
                // Internal errors don't expose details
                tracing::error!("Internal error: {}", self);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }

            CapsuleError::OpenAIError(msg) => {
                tracing::error!("OpenAI error: {}", msg);
                (StatusCode::BAD_GATEWAY, "AI service error".to_string())
            }

            CapsuleError::ConfigError(msg) => {
                tracing::error!("Config error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Configuration error".to_string(),
                )
            }

            CapsuleError::RateLimited(reason) => {
                (StatusCode::TOO_MANY_REQUESTS, reason.clone())
            }

            CapsuleError::SubscriptionRequired => {
                (
                    StatusCode::FORBIDDEN,
                    "Pro subscription required".to_string(),
                )
            }

            CapsuleError::HistoryTooLarge(msg) => {
                (StatusCode::BAD_REQUEST, msg.clone())
            }
        };

        let body = Json(json!({
            "error": error_message
        }));

        (status, body).into_response()
    }
}

impl From<anyhow::Error> for CapsuleError {
    fn from(err: anyhow::Error) -> Self {
        CapsuleError::Internal(err.to_string())
    }
}
