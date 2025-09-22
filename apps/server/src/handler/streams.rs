use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use rand::Rng;
use rtp::packet::Packet;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::{
    sync::{broadcast, RwLock},
    time::Instant,
};
use tracing::info;

use crate::{
    db::{self, models::NewStream},
    handler::auth::DeviceTokenAuth,
    state::{AppState, MediaType, StreamInfo},
};

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

    let db_stream = match db::repository::streams::upsert_stream(&state.pool, &new_stream_db) {
        Ok(stream) => stream,
        Err(e) => {
            tracing::error!("Failed to upsert stream to database: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR).into_response();
        }
    };

    let (packet_tx, _) = broadcast::channel::<Packet>(1024);

    let stream_info = StreamInfo {
        topic: payload.topic.clone(),
        user_id: auth.device_id,
        packet_tx,
        media_type: payload.media_type,
        last_seen: Arc::new(std::sync::RwLock::new(Instant::now())),
        is_online: Arc::new(std::sync::RwLock::new(false)),
    };

    state.streams.insert(ssrc, stream_info);

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
