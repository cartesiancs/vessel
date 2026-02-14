use axum::{
    routing::{get, post},
    Extension, Router,
};
use std::sync::Arc;
use tower_http::{
    cors::{AllowHeaders, AllowMethods, AllowOrigin, CorsLayer},
    limit::RequestBodyLimitLayer,
    trace::TraceLayer,
};

use crate::api::{chat_handler, chat_stream_handler, public_key_handler};
use crate::services::JwtValidator;
use crate::AppState;

/// Max request body size: 100MB (for encrypted images)
const MAX_BODY_SIZE: usize = 100 * 1024 * 1024;

/// Router configuration
pub struct RouterConfig {
    /// Allowed CORS origins
    pub allowed_origins: Vec<String>,
}

/// Create API router
pub fn create_router(
    state: Arc<AppState>,
    config: &RouterConfig,
    jwt_validator: Arc<JwtValidator>,
) -> Router {
    // CORS configuration
    let cors = build_cors_layer(config);

    Router::new()
        // Health check (public)
        .route("/health", get(health_handler))
        // Public Key endpoint (public)
        .route("/api/public-key", get(public_key_handler))
        // Chat endpoints (authenticated)
        .route("/api/chat", post(chat_handler))
        .route("/api/chat/stream", post(chat_stream_handler))
        // Middleware
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .layer(RequestBodyLimitLayer::new(MAX_BODY_SIZE))
        // JWT validator extension for auth extractor
        .layer(Extension(jwt_validator))
        // State
        .with_state(state)
}

/// Build CORS layer
fn build_cors_layer(config: &RouterConfig) -> CorsLayer {
    let allowed_origins = &config.allowed_origins;

    if allowed_origins.is_empty() || allowed_origins.iter().any(|o| o == "*") {
        // Development: Allow all origins (with warning)
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
        // Production: Allow only specified origins
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

/// Health check handler
async fn health_handler() -> &'static str {
    "OK"
}
