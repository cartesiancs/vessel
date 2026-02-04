use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Enclave 에러 타입
#[derive(Error, Debug)]
pub enum EnclaveError {
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
}

impl IntoResponse for EnclaveError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            EnclaveError::InvalidPublicKey
            | EnclaveError::InvalidNonce
            | EnclaveError::InvalidCiphertext => (StatusCode::BAD_REQUEST, self.to_string()),

            EnclaveError::DecryptionFailed => {
                (StatusCode::BAD_REQUEST, "Decryption failed".to_string())
            }

            EnclaveError::CipherInitFailed | EnclaveError::Internal(_) => {
                // 내부 에러는 상세 내용을 노출하지 않음
                tracing::error!("Internal error: {}", self);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal server error".to_string(),
                )
            }

            EnclaveError::OpenAIError(msg) => {
                tracing::error!("OpenAI error: {}", msg);
                (StatusCode::BAD_GATEWAY, "AI service error".to_string())
            }

            EnclaveError::ConfigError(msg) => {
                tracing::error!("Config error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Configuration error".to_string(),
                )
            }
        };

        let body = Json(json!({
            "error": error_message
        }));

        (status, body).into_response()
    }
}

impl From<anyhow::Error> for EnclaveError {
    fn from(err: anyhow::Error) -> Self {
        EnclaveError::Internal(err.to_string())
    }
}
