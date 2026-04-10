use axum::{extract::State, Json};
use std::sync::Arc;

use crate::types::PublicKeyResponse;
use crate::AppState;

/// GET /api/public-key
///
/// 서버의 공개키를 반환합니다.
/// 클라이언트는 이 키로 이미지를 암호화합니다.
///
/// # Response
/// ```json
/// {
///   "public_key": "base64_encoded_public_key",
///   "key_id": "key_identifier",
///   "expires_at": "2024-01-01T00:00:00Z"
/// }
/// ```
pub async fn public_key_handler(State(state): State<Arc<AppState>>) -> Json<PublicKeyResponse> {
    let (public_key, key_id, expires_at) = state.key_manager.current_public_key().await;

    tracing::info!(key_id = %key_id, "Public key requested");

    Json(PublicKeyResponse {
        public_key,
        key_id,
        expires_at,
    })
}
