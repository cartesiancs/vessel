use zeroize::Zeroizing;

use crate::error::CapsuleError;

/// Application configuration
pub struct Config {
    /// Server port
    pub port: u16,
    /// OpenAI API key (protected with Zeroizing)
    pub openai_api_key: Zeroizing<String>,
    /// OpenAI model (default: gpt-4o)
    pub openai_model: String,
    /// Allowed CORS origins
    pub allowed_origins: Vec<String>,
    /// Supabase project URL
    pub supabase_url: String,
    /// Supabase service role key (protected with Zeroizing)
    pub supabase_service_key: Zeroizing<String>,
    /// Key rotation interval in seconds (default: 86400 = 24 hours)
    pub key_rotation_interval_secs: u64,
    /// Grace period for previous key in seconds (default: 300 = 5 minutes)
    pub key_grace_period_secs: u64,
}

impl Config {
    /// Load configuration from environment variables
    ///
    /// # Security
    /// - API keys are protected with `Zeroizing<String>`
    /// - Sensitive environment variables are removed after loading
    pub fn from_env() -> Result<Self, CapsuleError> {
        dotenvy::dotenv().ok();

        // Load OpenAI API key
        let openai_api_key = std::env::var("OPENAI_API_KEY").map_err(|_| {
            CapsuleError::ConfigError("OPENAI_API_KEY environment variable is required".to_string())
        })?;

        // Load Supabase configuration
        let supabase_url = std::env::var("SUPABASE_URL").map_err(|_| {
            CapsuleError::ConfigError("SUPABASE_URL environment variable is required".to_string())
        })?;

        let supabase_service_key = std::env::var("SUPABASE_SERVICE_KEY").map_err(|_| {
            CapsuleError::ConfigError(
                "SUPABASE_SERVICE_KEY environment variable is required".to_string(),
            )
        })?;

        // Security: Remove sensitive environment variables
        std::env::remove_var("OPENAI_API_KEY");
        std::env::remove_var("SUPABASE_SERVICE_KEY");
        tracing::debug!("Removed sensitive environment variables");

        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "3000".to_string())
            .parse()
            .unwrap_or(3000);

        let openai_model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o".to_string());

        // CORS allowed origins (comma-separated)
        let allowed_origins = std::env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "*".to_string())
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let key_rotation_interval_secs = std::env::var("KEY_ROTATION_INTERVAL_SECS")
            .unwrap_or_else(|_| "86400".to_string())
            .parse()
            .unwrap_or(86400);

        let key_grace_period_secs = std::env::var("KEY_GRACE_PERIOD_SECS")
            .unwrap_or_else(|_| "300".to_string())
            .parse()
            .unwrap_or(300);

        Ok(Self {
            port,
            openai_api_key: Zeroizing::new(openai_api_key),
            openai_model,
            allowed_origins,
            supabase_url,
            supabase_service_key: Zeroizing::new(supabase_service_key),
            key_rotation_interval_secs,
            key_grace_period_secs,
        })
    }
}
