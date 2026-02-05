mod api;
mod config;
mod crypto;
mod error;
mod services;
mod types;

use std::sync::Arc;

use config::Config;
use crypto::KeyManager;
use services::{JwtValidator, OpenAIService, UsageTracker};

/// Application state
///
/// # Security
/// - `KeyManager` holds private key internally
/// - Private key is never exposed externally
/// - JWT validator uses Zeroizing for secret storage
/// - Usage tracker uses service key for Supabase API calls
pub struct AppState {
    /// Key manager (encryption/decryption)
    pub key_manager: KeyManager,
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
                .add_directive("enclave=debug".parse().unwrap()),
        )
        .init();

    tracing::info!("Starting Enclave server...");

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

    // Create application state
    // KeyManager generates a new key pair here (exists only in memory)
    let openai_model = config.openai_model.clone();
    let state = Arc::new(AppState {
        key_manager: KeyManager::new(),
        openai: OpenAIService::new(config.openai_api_key).with_model(openai_model),
        jwt_validator: jwt_validator.clone(),
        usage_tracker,
    });

    tracing::info!(
        "Key pair generated (public key: {}...)",
        &state.key_manager.public_key_base64()[..20]
    );

    // Create router
    let app = api::create_router(state, &app_config, jwt_validator);

    // Start server
    let addr = format!("0.0.0.0:{}", config.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!("Enclave server listening on {}", addr);
    tracing::info!("Security: Private key exists only in memory");
    tracing::info!("Security: Decrypted images are zeroized after use");
    tracing::info!("Security: API keys protected with Zeroizing<String>");
    tracing::info!("Security: JWT authentication required for chat endpoints");
    tracing::info!("Security: Subscription verification via Supabase");

    axum::serve(listener, app).await?;

    Ok(())
}
