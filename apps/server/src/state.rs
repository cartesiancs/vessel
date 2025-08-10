use std::sync::Arc;
use tokio::sync::broadcast;
use webrtc::rtp::packet::Packet;
use serde::Serialize;
use bytes::Bytes;

use diesel::sqlite::SqliteConnection;
use diesel::r2d2::{self, ConnectionManager};

pub type DbPool = r2d2::Pool<ConnectionManager<SqliteConnection>>;

#[derive(Serialize, Clone, Debug)]
pub struct MqttMessage {
    pub topic: String,
    pub bytes: Bytes,
}

pub struct AppState {
    pub packet_tx: broadcast::Sender<Packet>,
    pub mqtt_tx: broadcast::Sender<MqttMessage>,
    pub jwt_secret: String, 
    pub pool: DbPool,
}