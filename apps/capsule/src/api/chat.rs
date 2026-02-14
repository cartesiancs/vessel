//! Chat API handlers with authentication and usage tracking
//!
//! # Security Data Flow
//! 1. Extract and validate JWT token (AuthUser extractor)
//! 2. Check subscription status (billing_subscriptions table)
//! 3. Check rate limits (enclave_usage table)
//! 4. Process request (decrypt image if present)
//! 5. Track usage (fire-and-forget)
//! 6. Return response

use axum::{
    extract::State,
    response::sse::{Event, Sse},
    Json,
};
use futures_util::{stream::Stream, StreamExt};
use std::sync::Arc;

use crate::api::AuthUser;
use crate::error::EnclaveError;
use crate::types::{ChatRequest, ChatResponse};
use crate::AppState;

/// POST /api/chat
///
/// Receives encrypted image and message, returns AI response.
///
/// # Authentication
/// Requires valid Supabase JWT token in Authorization header.
///
/// # Subscription
/// Only users with active Pro subscription can access this endpoint.
///
/// # Security Data Flow
/// 1. `EncryptedImage` received (safe to log)
/// 2. Decrypted to `DecryptedImage` (memory only)
/// 3. OpenAI API call (using decrypted image)
/// 4. `DecryptedImage` auto-dropped → memory zeroized
/// 5. Response returned
pub async fn chat_handler(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, EnclaveError> {
    // 1. Check subscription and rate limits
    let rate_status = state
        .usage_tracker
        .check_rate_limit(&auth.user_id)
        .await
        .map_err(|e| EnclaveError::Internal(e.to_string()))?;

    // 2. Block non-subscribers
    if !rate_status.subscribed {
        tracing::info!(user_id = %auth.user_id, "Subscription required");
        return Err(EnclaveError::SubscriptionRequired);
    }

    // 3. Check rate limit
    if !rate_status.allowed {
        tracing::info!(
            user_id = %auth.user_id,
            reason = ?rate_status.reason,
            "Rate limited"
        );
        return Err(EnclaveError::RateLimited(
            rate_status.reason.unwrap_or_else(|| "Rate limit exceeded".to_string()),
        ));
    }

    tracing::info!(
        user_id = %auth.user_id,
        message_len = req.message.len(),
        has_image = req.encrypted_image.is_some(),
        "Chat request"
    );

    let is_image_request = req.encrypted_image.is_some();

    // 4. Process request
    let result = if let Some(encrypted_image) = req.encrypted_image {
        // Decrypt (DecryptedImage created)
        // - DecryptedImage doesn't implement Debug/Clone
        // - Auto zeroize on Drop
        let decrypted = state.key_manager.decrypt(&encrypted_image).await?;

        tracing::debug!("Image decrypted: {} bytes", decrypted.len());

        // OpenAI API call (ownership transfer of decrypted)
        // - Auto drop → zeroize at function end
        state
            .openai
            .analyze_image(&req.message, decrypted)
            .await
            .map_err(|e| EnclaveError::OpenAIError(e.to_string()))?
    } else {
        // Text only
        state
            .openai
            .chat(&req.message)
            .await
            .map_err(|e| EnclaveError::OpenAIError(e.to_string()))?
    };

    tracing::info!(
        user_id = %auth.user_id,
        response_len = result.content.len(),
        input_tokens = result.usage.prompt_tokens,
        output_tokens = result.usage.completion_tokens,
        "Chat response generated"
    );

    // 5. Track usage (fire-and-forget)
    let tracker = state.usage_tracker.clone();
    let user_id = auth.user_id.clone();
    let input_tokens = result.usage.prompt_tokens;
    let output_tokens = result.usage.completion_tokens;
    tokio::spawn(async move {
        if let Err(e) = tracker.track_request(&user_id, input_tokens, output_tokens, is_image_request).await {
            tracing::warn!(error = %e, "Failed to track usage");
        }
    });

    Ok(Json(ChatResponse { response: result.content }))
}

/// POST /api/chat/stream
///
/// Returns streaming response via Server-Sent Events.
///
/// # Authentication
/// Requires valid Supabase JWT token in Authorization header.
///
/// # Subscription
/// Only users with active Pro subscription can access this endpoint.
pub async fn chat_stream_handler(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(req): Json<ChatRequest>,
) -> Result<Sse<impl Stream<Item = Result<Event, EnclaveError>>>, EnclaveError> {
    // 1. Check subscription and rate limits
    let rate_status = state
        .usage_tracker
        .check_rate_limit(&auth.user_id)
        .await
        .map_err(|e| EnclaveError::Internal(e.to_string()))?;

    // 2. Block non-subscribers
    if !rate_status.subscribed {
        tracing::info!(user_id = %auth.user_id, "Subscription required");
        return Err(EnclaveError::SubscriptionRequired);
    }

    // 3. Check rate limit
    if !rate_status.allowed {
        tracing::info!(
            user_id = %auth.user_id,
            reason = ?rate_status.reason,
            "Rate limited"
        );
        return Err(EnclaveError::RateLimited(
            rate_status.reason.unwrap_or_else(|| "Rate limit exceeded".to_string()),
        ));
    }

    tracing::info!(
        user_id = %auth.user_id,
        message_len = req.message.len(),
        has_image = req.encrypted_image.is_some(),
        "Stream chat request"
    );

    let is_image_request = req.encrypted_image.is_some();

    // 4. Process request
    let (stream, usage) = if let Some(encrypted_image) = req.encrypted_image {
        let decrypted = state.key_manager.decrypt(&encrypted_image).await?;
        tracing::debug!("Image decrypted for streaming: {} bytes", decrypted.len());

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

    // 5. Track usage after stream completes (fire-and-forget)
    let tracker = state.usage_tracker.clone();
    let user_id = auth.user_id.clone();

    // Wrap the stream to track usage when it completes
    let wrapped_stream = async_stream::stream! {
        let mut inner = std::pin::pin!(stream);
        while let Some(item) = inner.next().await {
            yield item;
        }

        // Stream completed, now track usage
        let (input_tokens, output_tokens) = {
            let guard = usage.lock().unwrap();
            (guard.prompt_tokens, guard.completion_tokens)
        };

        tracing::info!(
            user_id = %user_id,
            input_tokens = input_tokens,
            output_tokens = output_tokens,
            "Stream completed, tracking usage"
        );

        let tracker_clone = tracker.clone();
        let user_id_clone = user_id.clone();
        tokio::spawn(async move {
            if let Err(e) = tracker_clone.track_request(&user_id_clone, input_tokens, output_tokens, is_image_request).await {
                tracing::warn!(error = %e, "Failed to track usage");
            }
        });
    };

    Ok(Sse::new(wrapped_stream))
}
