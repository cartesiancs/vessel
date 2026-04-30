use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use tracing::{error, info, warn};

use crate::{
    db::{self, models::NewStream},
    handler::auth::{AuthUser, DeviceTokenAuth},
    state::{AppState, MediaType, Protocol, StreamDescriptor},
};

const HLS_TOKEN_AUDIENCE: &str = "hls";
const HLS_TOKEN_TTL_SECS: i64 = 3600;

#[derive(Deserialize)]
pub struct RegisterStreamRequest {
    pub topic: String,
    pub media_type: MediaType,
}

#[derive(Serialize)]
pub struct RegisterStreamResponse {
    ssrc: u32,
    rtp_port: u16,
}

pub async fn register_stream(
    State(state): State<Arc<AppState>>,
    DeviceTokenAuth { device: auth }: DeviceTokenAuth,
    Json(payload): Json<RegisterStreamRequest>,
) -> impl IntoResponse {
    let ssrc = rand::rngs::ThreadRng::default().random_range(0..=i32::MAX) as u32;

    let media_type_str = match payload.media_type {
        MediaType::Audio => "audio",
        MediaType::Video => "video",
    };

    let new_stream_db = NewStream {
        ssrc: ssrc as i32,
        topic: &payload.topic,
        device_id: &auth.device_id,
        media_type: media_type_str,
    };

    let _db_stream = match db::repository::streams::upsert_stream(&state.pool, &new_stream_db) {
        Ok(stream) => stream,
        Err(e) => {
            tracing::error!("Failed to upsert stream to database: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR).into_response();
        }
    };

    let descriptor = StreamDescriptor {
        id: ssrc,
        topic: payload.topic.clone(),
        user_id: auth.device_id,
        media_type: payload.media_type,
        protocol: Protocol::Udp,
    };

    state.streams.register(descriptor);

    info!(
        "[API] SSRC {} for topic '{}' inserted. Manager size: {}",
        ssrc,
        payload.topic,
        state.streams.len()
    );

    info!(
        "New stream registered. Topic: '{}', SSRC: {}, Port: 5004",
        payload.topic, ssrc
    );

    let configs = match db::repository::get_all_system_configs(&state.pool) {
        Ok(configs) => configs,
        Err(e) => {
            tracing::error!("Failed to get system configs: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR).into_response();
        }
    };

    let rtp_port = configs
        .iter()
        .find(|c| c.key == "rtp_broker_port")
        .and_then(|c| c.value.parse::<u16>().ok())
        .unwrap_or(5004);

    (
        StatusCode::OK,
        Json(RegisterStreamResponse { ssrc, rtp_port }),
    )
        .into_response()
}

#[derive(Debug, Serialize, Deserialize)]
struct HlsClaims {
    sub: String,    // username
    topic: String,
    aud: String,
    exp: usize,
}

#[derive(Serialize)]
pub struct HlsTokenResponse {
    pub token: String,
    pub expires_in: i64,
}

#[derive(Deserialize)]
pub struct HlsTokenQuery {
    pub token: String,
}

fn issue_hls_token_for(secret: &str, sub: &str, topic: &str) -> Result<String, jsonwebtoken::errors::Error> {
    let exp = (chrono::Utc::now() + chrono::Duration::seconds(HLS_TOKEN_TTL_SECS)).timestamp() as usize;
    let claims = HlsClaims {
        sub: sub.to_string(),
        topic: topic.to_string(),
        aud: HLS_TOKEN_AUDIENCE.to_string(),
        exp,
    };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_ref()),
    )
}

fn validate_hls_token(secret: &str, token: &str, expected_topic: &str) -> Result<HlsClaims, StatusCode> {
    let mut validation = Validation::default();
    validation.set_audience(&[HLS_TOKEN_AUDIENCE]);
    let data = decode::<HlsClaims>(token, &DecodingKey::from_secret(secret.as_ref()), &validation)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;
    if data.claims.topic != expected_topic {
        return Err(StatusCode::FORBIDDEN);
    }
    Ok(data.claims)
}

pub async fn issue_hls_token(
    State(state): State<Arc<AppState>>,
    AuthUser(user): AuthUser,
    Path(topic): Path<String>,
) -> Response {
    if !state.hls_manager.has_video_stream(&topic) {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Video stream not found for topic" })),
        )
            .into_response();
    }

    match issue_hls_token_for(&state.jwt_secret, &user.username, &topic) {
        Ok(token) => (
            StatusCode::OK,
            Json(HlsTokenResponse {
                token,
                expires_in: HLS_TOKEN_TTL_SECS,
            }),
        )
            .into_response(),
        Err(e) => {
            error!("Failed to issue HLS token: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR).into_response()
        }
    }
}

pub async fn get_hls_playlist(
    State(state): State<Arc<AppState>>,
    Path(topic): Path<String>,
    Query(q): Query<HlsTokenQuery>,
) -> Response {
    if let Err(status) = validate_hls_token(&state.jwt_secret, &q.token, &topic) {
        return (status).into_response();
    }

    let playlist_path = match state.hls_manager.ensure_session(&topic).await {
        Ok(p) => p,
        Err(e) => {
            warn!("HLS ensure_session failed for '{}': {}", topic, e);
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };
    state.hls_manager.touch(&topic).await;

    let raw = match tokio::fs::read_to_string(&playlist_path).await {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to read playlist {}: {}", playlist_path.display(), e);
            return (StatusCode::INTERNAL_SERVER_ERROR).into_response();
        }
    };

    let body = rewrite_playlist_with_token(&raw, &q.token);

    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "application/vnd.apple.mpegurl"),
            (header::CACHE_CONTROL, "no-cache, no-store, must-revalidate"),
        ],
        body,
    )
        .into_response()
}

pub async fn get_hls_segment(
    State(state): State<Arc<AppState>>,
    Path((topic, segment)): Path<(String, String)>,
    Query(q): Query<HlsTokenQuery>,
) -> Response {
    if let Err(status) = validate_hls_token(&state.jwt_secret, &q.token, &topic) {
        return (status).into_response();
    }

    let segment_path = match state.hls_manager.segment_path(&topic, &segment) {
        Ok(p) => p,
        Err(e) => {
            warn!("Invalid segment request {}/{}: {}", topic, segment, e);
            return (StatusCode::BAD_REQUEST).into_response();
        }
    };

    state.hls_manager.touch(&topic).await;

    if !segment_path.exists() {
        return (StatusCode::NOT_FOUND).into_response();
    }

    let file = match File::open(&segment_path).await {
        Ok(f) => f,
        Err(e) => {
            error!("Failed to open segment {}: {}", segment_path.display(), e);
            return (StatusCode::INTERNAL_SERVER_ERROR).into_response();
        }
    };

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let content_type = if segment.ends_with(".m4s") || segment.ends_with(".mp4") {
        "video/mp4"
    } else {
        "video/mp2t"
    };

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CACHE_CONTROL, "no-cache")
        .body(body)
        .unwrap_or_else(|_| (StatusCode::INTERNAL_SERVER_ERROR).into_response())
}

fn rewrite_playlist_with_token(playlist: &str, token: &str) -> String {
    let mut out = String::with_capacity(playlist.len() + 64);
    for line in playlist.lines() {
        let trimmed = line.trim_end();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            out.push_str(trimmed);
        } else {
            out.push_str(trimmed);
            if trimmed.contains('?') {
                out.push('&');
            } else {
                out.push('?');
            }
            out.push_str("token=");
            out.push_str(token);
        }
        out.push('\n');
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rewrite_playlist_appends_token_to_segment_lines_only() {
        let input = "#EXTM3U\n#EXT-X-VERSION:6\n#EXTINF:2.0,\nseg_00001.ts\n#EXTINF:2.0,\nseg_00002.ts\n";
        let out = rewrite_playlist_with_token(input, "abc.def.ghi");
        assert!(out.contains("seg_00001.ts?token=abc.def.ghi"));
        assert!(out.contains("seg_00002.ts?token=abc.def.ghi"));
        assert!(out.contains("#EXTM3U"));
        assert!(!out.contains("#EXTM3U?token"));
    }
}
