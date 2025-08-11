
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use rand::Rng;
use rtp::packet::Packet;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use tracing::info;

use crate::{
    handler::auth::JwtAuth,
    state::{AppState, StreamInfo},
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
    JwtAuth(claims): JwtAuth, 
    Json(payload): Json<RegisterStreamRequest>,
) -> impl IntoResponse {

    let ssrc = rand::thread_rng().gen::<u32>();

    let (packet_tx, _) = broadcast::channel::<Packet>(1024);

    let stream_info = StreamInfo {
        topic: payload.topic.clone(),
        user_id: claims.sub,
        packet_tx,
    };
    
    state.streams.insert(ssrc, stream_info);

    println!(
        "[API] SSRC {} for topic '{}' inserted. Manager size: {}",
        ssrc,
        payload.topic,
        state.streams.len()
    );

    println!(
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