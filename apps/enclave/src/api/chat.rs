use axum::{
    extract::State,
    response::sse::{Event, Sse},
    Json,
};
use futures_util::stream::Stream;
use std::sync::Arc;

use crate::error::EnclaveError;
use crate::types::{ChatRequest, ChatResponse};
use crate::AppState;

/// POST /api/chat
///
/// 암호화된 이미지와 메시지를 받아 AI 응답을 반환합니다.
///
/// # 보안 데이터 흐름
/// 1. `EncryptedImage` 수신 (로깅 가능)
/// 2. `DecryptedImage`로 복호화 (메모리에만 존재)
/// 3. OpenAI API 호출 (복호화된 이미지 사용)
/// 4. `DecryptedImage` 자동 drop → 메모리 zeroize
/// 5. 응답 반환
///
/// # Request
/// ```json
/// {
///   "message": "이 이미지를 분석해주세요",
///   "encrypted_image": {
///     "ephemeral_public_key": "base64...",
///     "nonce": "base64...",
///     "ciphertext": "base64..."
///   }
/// }
/// ```
pub async fn chat_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, EnclaveError> {
    tracing::info!(
        "Chat request received: message_len={}, has_image={}",
        req.message.len(),
        req.encrypted_image.is_some()
    );

    let response = if let Some(encrypted_image) = req.encrypted_image {
        // 1. 복호화 (DecryptedImage 생성)
        //    - DecryptedImage는 Debug/Clone 미구현
        //    - Drop 시 자동 zeroize
        let decrypted = state.key_manager.decrypt(&encrypted_image).await?;

        tracing::debug!("Image decrypted: {} bytes", decrypted.len());

        // 2. OpenAI API 호출 (decrypted 소유권 이전)
        //    - 함수 종료 시 decrypted는 자동으로 drop → zeroize
        state
            .openai
            .analyze_image(&req.message, decrypted)
            .await
            .map_err(|e| EnclaveError::OpenAIError(e.to_string()))?
    } else {
        // 텍스트만 있는 경우
        state
            .openai
            .chat(&req.message)
            .await
            .map_err(|e| EnclaveError::OpenAIError(e.to_string()))?
    };

    tracing::info!("Chat response generated: {} chars", response.len());

    Ok(Json(ChatResponse { response }))
}

/// POST /api/chat/stream
///
/// 스트리밍 응답을 반환합니다.
pub async fn chat_stream_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, EnclaveError>>>, EnclaveError> {
    tracing::info!(
        "Stream chat request received: message_len={}, has_image={}",
        req.message.len(),
        req.encrypted_image.is_some()
    );

    let stream = if let Some(encrypted_image) = req.encrypted_image {
        // 복호화
        let decrypted = state.key_manager.decrypt(&encrypted_image).await?;
        tracing::debug!("Image decrypted for streaming: {} bytes", decrypted.len());

        // 스트리밍 응답
        state
            .openai
            .analyze_image_stream(&req.message, decrypted)
            .await
            .map_err(|e| EnclaveError::OpenAIError(e.to_string()))?
    } else {
        state
            .openai
            .chat_stream(&req.message)
            .await
            .map_err(|e| EnclaveError::OpenAIError(e.to_string()))?
    };

    Ok(Sse::new(stream))
}
