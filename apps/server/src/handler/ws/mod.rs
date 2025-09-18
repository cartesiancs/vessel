use axum::{
    extract::{ws::WebSocketUpgrade, State},
    response::Response,
};
use std::sync::Arc;
use tracing::info;

use crate::{
    handler::{auth::JwtAuth, ws::handlers::handle_socket},
    state::AppState,
};

use serde::{Deserialize, Serialize};
use serde_json::json;

pub mod handlers;
pub mod webrtc;

pub async fn ws_handler(
    JwtAuth(claims): JwtAuth,
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(move |socket| {
        info!("'{}' authenticated and connected.", claims.sub);
        handle_socket(socket, state)
    })
}

#[derive(Serialize)]
pub struct WsMessageOut<'a, T: Serialize> {
    #[serde(rename = "type")]
    msg_type: &'a str,
    payload: T,
}
