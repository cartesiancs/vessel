use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::{
    cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer},
    limit::RequestBodyLimitLayer,
    trace::TraceLayer,
};

use crate::api::{chat_handler, chat_stream_handler, public_key_handler};
use crate::AppState;

/// 최대 요청 Body 크기: 100MB (암호화된 이미지 포함)
const MAX_BODY_SIZE: usize = 100 * 1024 * 1024;

/// 라우터 설정
pub struct RouterConfig {
    /// 허용된 CORS Origin 목록
    pub allowed_origins: Vec<String>,
}

/// API 라우터 생성
pub fn create_router(state: Arc<AppState>, config: &RouterConfig) -> Router {
    // CORS 설정 - 허용된 Origin만
    let cors = build_cors_layer(config);

    Router::new()
        // Health check
        .route("/health", get(health_handler))
        // Public Key 엔드포인트
        .route("/api/public-key", get(public_key_handler))
        // Chat 엔드포인트
        .route("/api/chat", post(chat_handler))
        // Streaming Chat 엔드포인트
        .route("/api/chat/stream", post(chat_stream_handler))
        // Middleware
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .layer(RequestBodyLimitLayer::new(MAX_BODY_SIZE))
        // State
        .with_state(state)
}

/// CORS 레이어 구성
fn build_cors_layer(config: &RouterConfig) -> CorsLayer {
    let allowed_origins = &config.allowed_origins;

    if allowed_origins.is_empty() || allowed_origins.iter().any(|o| o == "*") {
        // 개발 환경: 모든 Origin 허용 (경고 로깅)
        tracing::warn!("CORS: Allowing all origins (development mode)");
        CorsLayer::new()
            .allow_origin(AllowOrigin::any())
            .allow_methods(AllowMethods::list([
                http::Method::GET,
                http::Method::POST,
                http::Method::OPTIONS,
            ]))
            .allow_headers(AllowHeaders::list([
                http::header::CONTENT_TYPE,
                http::header::AUTHORIZATION,
            ]))
    } else {
        // 프로덕션 환경: 지정된 Origin만 허용
        tracing::info!("CORS: Allowing origins: {:?}", allowed_origins);
        let origins: Vec<_> = allowed_origins
            .iter()
            .filter_map(|o| o.parse().ok())
            .collect();

        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods(AllowMethods::list([
                http::Method::GET,
                http::Method::POST,
                http::Method::OPTIONS,
            ]))
            .allow_headers(AllowHeaders::list([
                http::header::CONTENT_TYPE,
                http::header::AUTHORIZATION,
            ]))
    }
}

/// Health check 핸들러
async fn health_handler() -> &'static str {
    "OK"
}
