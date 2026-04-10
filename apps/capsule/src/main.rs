mod api;
mod config;
mod crypto;
mod error;
mod services;
mod types;

use std::sync::Arc;
use std::time::Duration;

use config::Config;
use crypto::KeyManager;
use services::{JwtValidator, OpenAIService, UsageTracker};

/// Application state
///
/// # Security
/// - `KeyManager` holds private keys internally with rotation support
/// - Private keys are never exposed externally
/// - Keys are rotated periodically to limit blast radius
/// - JWT validator uses Zeroizing for secret storage
/// - Usage tracker uses service key for Supabase API calls
pub struct AppState {
    /// Key manager (encryption/decryption with rotation)
    pub key_manager: Arc<KeyManager>,
    /// OpenAI service
    pub openai: OpenAIService,
    /// JWT validator for Supabase tokens
    pub jwt_validator: Arc<JwtValidator>,
    /// Usage tracker for rate limiting and billing
    pub usage_tracker: UsageTracker,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("capsule=debug".parse().unwrap()),
        )
        .init();

    tracing::info!("Starting Capsule server...");

    // Load configuration (API keys removed from env after loading)
    let config = Config::from_env()?;
    tracing::info!("Configuration loaded (port: {})", config.port);
    tracing::info!("CORS allowed origins: {:?}", config.allowed_origins);
    tracing::info!("Supabase URL: {}", config.supabase_url);

    // Router configuration
    let app_config = api::RouterConfig {
        allowed_origins: config.allowed_origins.clone(),
    };

    // Create JWT validator (uses JWKS from Supabase for ES256 validation)
    let jwt_validator = Arc::new(JwtValidator::new(config.supabase_url.clone()));

    // Create usage tracker
    let usage_tracker = UsageTracker::new(
        config.supabase_url.clone(),
        config.supabase_service_key,
    );

    // Create KeyManager with rotation configuration
    let key_manager = Arc::new(KeyManager::new(
        Duration::from_secs(config.key_rotation_interval_secs),
        Duration::from_secs(config.key_grace_period_secs),
    ));

    // Start background key rotation task
    let _rotation_handle = key_manager.start_rotation_task();

    // Create application state
    let openai_model = config.openai_model.clone();
    let state = Arc::new(AppState {
        key_manager: Arc::clone(&key_manager),
        openai: OpenAIService::new(config.openai_api_key).with_model(openai_model),
        jwt_validator: jwt_validator.clone(),
        usage_tracker,
    });

    // Create router
    let app = api::create_router(state, &app_config, jwt_validator);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Capsule server listening on {}", addr);
    tracing::info!("Security: Private keys exist only in memory");
    tracing::info!("Security: Key rotation enabled (interval: {}s, grace: {}s)",
        config.key_rotation_interval_secs, config.key_grace_period_secs);
    tracing::info!("Security: Decrypted images are zeroized after use");
    tracing::info!("Security: API keys protected with Zeroizing<String>");
    tracing::info!("Security: JWT authentication required for chat endpoints");
    tracing::info!("Security: Subscription verification via Supabase");

    axum::serve(listener, app).await?;

    Ok(())
}
