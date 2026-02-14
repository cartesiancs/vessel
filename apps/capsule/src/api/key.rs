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
///   "public_key": "base64_encoded_public_key"
/// }
/// ```
pub async fn public_key_handler(State(state): State<Arc<AppState>>) -> Json<PublicKeyResponse> {
    tracing::info!("Public key requested");

    Json(PublicKeyResponse {
        public_key: state.key_manager.public_key_base64(),
    })
}
