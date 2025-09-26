use bytes::Bytes;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, RwLock};
use tokio::time::Instant;
use webrtc::rtp::packet::Packet;

use diesel::r2d2::{self, ConnectionManager};
use diesel::sqlite::SqliteConnection;

pub type DbPool = r2d2::Pool<ConnectionManager<SqliteConnection>>;

use dashmap::DashMap;

use crate::db::models::SystemConfiguration;
use crate::flow::manager_state::FlowManagerCommand;

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Audio,
    Video,
}

#[derive(Clone)]
pub struct StreamInfo {
    pub topic: String,
    pub user_id: String,
    pub packet_tx: broadcast::Sender<Packet>,
    pub media_type: MediaType,
    pub last_seen: Arc<std::sync::RwLock<Instant>>,
    pub is_online: Arc<std::sync::RwLock<bool>>,
}

pub type StreamManager = Arc<DashMap<u32, StreamInfo>>;

#[derive(Serialize, Clone, Debug)]
pub struct MqttMessage {
    pub topic: String,
    pub bytes: Bytes,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub enum Protocol {
    MQTT,
    Udp,
    Lora,
    RTSP,
}

#[derive(Serialize, Clone, Debug)]
pub struct TopicMapping {
    pub protocol: Protocol,
    pub topic: String,
    pub entity_id: String,
}

pub struct AppState {
    pub streams: StreamManager,
    pub mqtt_tx: broadcast::Sender<MqttMessage>,
    pub jwt_secret: String,
    pub pool: DbPool,
    pub topic_map: Arc<RwLock<Vec<TopicMapping>>>,
    pub flow_manager_tx: mpsc::Sender<FlowManagerCommand>,
    pub broadcast_tx: broadcast::Sender<String>,
    pub system_configs: Vec<SystemConfiguration>,
}
