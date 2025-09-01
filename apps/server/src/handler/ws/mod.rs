use axum::{
    extract::{ws::WebSocketUpgrade, State},
    response::Response,
};
use tracing::info;
use std::sync::Arc;

use crate::{handler::{auth::JwtAuth, ws::handlers::handle_socket}, state::AppState};


pub mod handlers;


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
