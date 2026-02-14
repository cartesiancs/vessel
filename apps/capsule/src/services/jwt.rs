//! JWT validation service for Supabase tokens
//!
//! Validates Supabase JWT tokens using ES256 algorithm with JWKS.
//! Extracts user_id (sub claim) for authentication.

use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use thiserror::Error;
use tokio::sync::RwLock;

/// JWT validation errors
#[derive(Error, Debug)]
pub enum JwtError {
    #[error("Invalid token format")]
    InvalidFormat,

    #[error("Token expired")]
    Expired,

    #[error("Invalid signature")]
    InvalidSignature,

    #[error("Invalid audience")]
    InvalidAudience,

    #[error("JWKS fetch failed: {0}")]
    JwksFetchFailed(String),

    #[error("No matching key found")]
    NoMatchingKey,

    #[error("Validation failed: {0}")]
    ValidationFailed(String),
}

/// JWKS response from Supabase
#[derive(Debug, Deserialize)]
struct JwksResponse {
    keys: Vec<Jwk>,
}

/// JSON Web Key
#[derive(Debug, Clone, Deserialize)]
struct Jwk {
    kty: String,
    #[serde(default)]
    kid: Option<String>,
    #[serde(default)]
    alg: Option<String>,
    /// EC curve (for ES256)
    #[serde(default)]
    crv: Option<String>,
    /// EC x coordinate (base64url)
    #[serde(default)]
    x: Option<String>,
    /// EC y coordinate (base64url)
    #[serde(default)]
    y: Option<String>,
}

/// Supabase JWT claims
///
/// Contains the standard claims from Supabase auth tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabaseClaims {
    /// Subject - User ID (UUID)
    pub sub: String,

    /// Audience - Should be "authenticated"
    pub aud: String,

    /// User role
    pub role: String,

    /// Expiration timestamp
    pub exp: usize,

    /// Issued at timestamp
    pub iat: usize,

    /// User email (optional)
    pub email: Option<String>,
}

/// Cached JWKS data
struct CachedJwks {
    keys: Vec<Jwk>,
    fetched_at: std::time::Instant,
}

/// JWT validator for Supabase tokens
///
/// # Security
/// - Uses ES256 algorithm with JWKS public keys
/// - Validates audience claim to ensure token is for authenticated users
/// - Validates expiration to prevent replay attacks
/// - JWKS is cached for 1 hour to reduce network calls
pub struct JwtValidator {
    /// Supabase URL for JWKS endpoint
    supabase_url: String,
    /// HTTP client
    client: reqwest::Client,
    /// Cached JWKS
    jwks_cache: Arc<RwLock<Option<CachedJwks>>>,
}

impl JwtValidator {
    /// Create a new JWT validator
    ///
    /// # Arguments
    /// * `supabase_url` - Supabase project URL
    pub fn new(supabase_url: String) -> Self {
        Self {
            supabase_url,
            client: reqwest::Client::new(),
            jwks_cache: Arc::new(RwLock::new(None)),
        }
    }

    /// Fetch JWKS from Supabase (with caching)
    async fn get_jwks(&self) -> Result<Vec<Jwk>, JwtError> {
        // Check cache
        {
            let cache = self.jwks_cache.read().await;
            if let Some(cached) = cache.as_ref() {
                // Cache valid for 1 hour
                if cached.fetched_at.elapsed() < std::time::Duration::from_secs(3600) {
                    return Ok(cached.keys.clone());
                }
            }
        }

        // Fetch from Supabase
        let jwks_url = format!("{}/auth/v1/.well-known/jwks.json", self.supabase_url);
        tracing::debug!("Fetching JWKS from: {}", jwks_url);

        let response = self
            .client
            .get(&jwks_url)
            .send()
            .await
            .map_err(|e| JwtError::JwksFetchFailed(e.to_string()))?;

        if !response.status().is_success() {
            return Err(JwtError::JwksFetchFailed(format!(
                "HTTP {}",
                response.status()
            )));
        }

        let jwks: JwksResponse = response
            .json()
            .await
            .map_err(|e| JwtError::JwksFetchFailed(e.to_string()))?;

        tracing::debug!("Fetched {} keys from JWKS", jwks.keys.len());

        // Update cache
        {
            let mut cache = self.jwks_cache.write().await;
            *cache = Some(CachedJwks {
                keys: jwks.keys.clone(),
                fetched_at: std::time::Instant::now(),
            });
        }

        Ok(jwks.keys)
    }

    /// Validate a JWT token and extract claims
    ///
    /// # Arguments
    /// * `token` - Bearer token string (without "Bearer " prefix)
    ///
    /// # Returns
    /// * `Ok(SupabaseClaims)` - Validated claims including user_id
    /// * `Err(JwtError)` - Validation failure reason
    ///
    /// # Security
    /// - Validates ES256 signature against JWKS public key
    /// - Checks "authenticated" audience claim
    /// - Verifies token has not expired
    pub async fn validate(&self, token: &str) -> Result<SupabaseClaims, JwtError> {
        // Decode header to get kid
        let header = decode_header(token).map_err(|e| JwtError::InvalidFormat)?;
        tracing::debug!("JWT header: alg={:?}, kid={:?}", header.alg, header.kid);

        // Fetch JWKS
        let keys = self.get_jwks().await?;

        // Find matching key
        let jwk = if let Some(kid) = &header.kid {
            keys.iter().find(|k| k.kid.as_ref() == Some(kid))
        } else {
            // Use first ES256 key if no kid
            keys.iter()
                .find(|k| k.alg.as_deref() == Some("ES256") || k.crv.as_deref() == Some("P-256"))
        }
        .ok_or(JwtError::NoMatchingKey)?;

        // Build decoding key from JWK
        let decoding_key = self.jwk_to_decoding_key(jwk)?;

        // Validate token
        let mut validation = Validation::new(Algorithm::ES256);
        validation.set_audience(&["authenticated"]);

        let token_data =
            decode::<SupabaseClaims>(token, &decoding_key, &validation).map_err(|e| {
                match e.kind() {
                    jsonwebtoken::errors::ErrorKind::ExpiredSignature => JwtError::Expired,
                    jsonwebtoken::errors::ErrorKind::InvalidSignature => JwtError::InvalidSignature,
                    jsonwebtoken::errors::ErrorKind::InvalidAudience => JwtError::InvalidAudience,
                    _ => JwtError::ValidationFailed(e.to_string()),
                }
            })?;

        Ok(token_data.claims)
    }

    /// Convert JWK to DecodingKey
    fn jwk_to_decoding_key(&self, jwk: &Jwk) -> Result<DecodingKey, JwtError> {
        if jwk.kty != "EC" {
            return Err(JwtError::ValidationFailed(format!(
                "Unsupported key type: {}",
                jwk.kty
            )));
        }

        let x = jwk
            .x
            .as_ref()
            .ok_or_else(|| JwtError::ValidationFailed("Missing x coordinate".to_string()))?;
        let y = jwk
            .y
            .as_ref()
            .ok_or_else(|| JwtError::ValidationFailed("Missing y coordinate".to_string()))?;

        // Build JWK JSON for jsonwebtoken
        let jwk_json = serde_json::json!({
            "kty": "EC",
            "crv": "P-256",
            "x": x,
            "y": y
        });

        DecodingKey::from_jwk(
            &serde_json::from_value(jwk_json)
                .map_err(|e| JwtError::ValidationFailed(format!("Invalid JWK format: {}", e)))?,
        )
        .map_err(|e| JwtError::ValidationFailed(format!("Failed to create decoding key: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_invalid_token() {
        let validator = JwtValidator::new("https://example.supabase.co".to_string());
        let result = validator.validate("invalid-token").await;
        assert!(result.is_err());
    }
}
