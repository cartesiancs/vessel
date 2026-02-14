//! Usage tracking service for rate limiting and billing
//!
//! Communicates with Supabase to:
//! 1. Check subscription status (billing_subscriptions table)
//! 2. Check rate limits (enclave_rate_limits table)
//! 3. Track usage (enclave_usage table)

use reqwest::Client;
use serde::Deserialize;
use zeroize::Zeroizing;

/// Rate limit check result from Supabase RPC
#[derive(Debug, Deserialize)]
pub struct RateLimitStatus {
    /// Whether the request is allowed
    pub allowed: bool,

    /// Reason for denial (if not allowed)
    pub reason: Option<String>,

    /// Whether user has active subscription
    pub subscribed: bool,

    /// Remaining requests for today
    pub requests_remaining: i32,

    /// Remaining tokens for today
    pub tokens_remaining: i32,
}

/// Usage tracking service
///
/// # Security
/// - Service key is stored in `Zeroizing<String>`
/// - All requests use HTTPS to Supabase
/// - Fire-and-forget usage tracking doesn't block responses
#[derive(Clone)]
pub struct UsageTracker {
    client: Client,
    supabase_url: String,
    service_key: Zeroizing<String>,
}

impl UsageTracker {
    /// Create a new usage tracker
    ///
    /// # Arguments
    /// * `supabase_url` - Supabase project URL
    /// * `service_key` - Supabase service role key (NOT anon key)
    pub fn new(supabase_url: String, service_key: Zeroizing<String>) -> Self {
        Self {
            client: Client::new(),
            supabase_url,
            service_key,
        }
    }

    /// Check if user can make a request
    ///
    /// Calls the `check_rate_limit` RPC function which:
    /// 1. Verifies active subscription in billing_subscriptions
    /// 2. Checks daily request/token limits
    ///
    /// # Arguments
    /// * `user_id` - User UUID from JWT claims
    ///
    /// # Returns
    /// * `RateLimitStatus` with allowed flag and remaining quotas
    pub async fn check_rate_limit(&self, user_id: &str) -> Result<RateLimitStatus, anyhow::Error> {
        let url = format!("{}/rest/v1/rpc/check_rate_limit", self.supabase_url);

        tracing::debug!(user_id = %user_id, "Checking rate limit");

        let response = self
            .client
            .post(&url)
            .header("apikey", self.service_key.as_str())
            .header(
                "Authorization",
                format!("Bearer {}", self.service_key.as_str()),
            )
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({ "p_user_id": user_id }))
            .send()
            .await?;

        if !response.status().is_success() {
            let status_code = response.status();
            let error_text = response.text().await.unwrap_or_default();
            tracing::error!(
                status = %status_code,
                error = %error_text,
                "check_rate_limit RPC failed - check if function exists in Supabase"
            );
            return Err(anyhow::anyhow!("Supabase RPC error: {}", error_text));
        }

        let status = response.json::<RateLimitStatus>().await?;
        tracing::debug!(
            allowed = status.allowed,
            subscribed = status.subscribed,
            requests_remaining = status.requests_remaining,
            "Rate limit check result"
        );
        Ok(status)
    }

    /// Track a completed request
    ///
    /// Calls the `increment_usage` RPC function to record:
    /// - Request count
    /// - Input/output tokens
    /// - Image request flag
    ///
    /// # Note
    /// This is designed to be called in a fire-and-forget manner
    /// using `tokio::spawn` to not block the response.
    ///
    /// # Arguments
    /// * `user_id` - User UUID from JWT claims
    /// * `input_tokens` - Number of input tokens used
    /// * `output_tokens` - Number of output tokens generated
    /// * `is_image_request` - Whether this was an image analysis request
    pub async fn track_request(
        &self,
        user_id: &str,
        input_tokens: i32,
        output_tokens: i32,
        is_image_request: bool,
    ) -> Result<(), anyhow::Error> {
        let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
        let url = format!("{}/rest/v1/rpc/increment_usage", self.supabase_url);

        tracing::debug!(
            user_id = %user_id,
            date = %today,
            is_image = is_image_request,
            "Tracking usage request"
        );

        let response = self
            .client
            .post(&url)
            .header("apikey", self.service_key.as_str())
            .header(
                "Authorization",
                format!("Bearer {}", self.service_key.as_str()),
            )
            .header("Content-Type", "application/json")
            .json(&serde_json::json!({
                "p_user_id": user_id,
                "p_date": today,
                "p_request_count": 1,
                "p_input_tokens": input_tokens,
                "p_output_tokens": output_tokens,
                "p_image_requests": if is_image_request { 1 } else { 0 }
            }))
            .send()
            .await?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            tracing::error!(
                status = %status,
                error = %error_text,
                "Failed to track usage - check if increment_usage RPC function exists"
            );
            return Err(anyhow::anyhow!("Supabase RPC error: {}", error_text));
        }

        tracing::info!(user_id = %user_id, "Usage tracked successfully");
        Ok(())
    }
}
