
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use rand::Rng;
use rtp::packet::Packet;
use serde::{Deserialize, Serialize};
use tracing::info;
use std::sync::Arc;
use tokio::sync::broadcast;

use crate::{
    handler::auth::{DeviceTokenAuth},
    state::{AppState, MediaType, StreamInfo},
};

#[derive(Deserialize)]
pub struct RegisterStreamRequest {
    pub topic: String,
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

    let ssrc = rand::rng().random::<u32>();

    let (packet_tx, _) = broadcast::channel::<Packet>(1024);

    let stream_info = StreamInfo {
        topic: payload.topic.clone(),
        user_id: auth.device_id,
        packet_tx,
        media_type: MediaType::Audio
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

    (
        StatusCode::OK,
        Json(RegisterStreamResponse {
            ssrc,
            rtp_port: 5004,
        }),
    )
}