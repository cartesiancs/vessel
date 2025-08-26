use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use webrtc::rtp::packet::Packet;
use serde::Serialize;
use bytes::Bytes;

use diesel::sqlite::SqliteConnection;
use diesel::r2d2::{self, ConnectionManager};

pub type DbPool = r2d2::Pool<ConnectionManager<SqliteConnection>>;

use dashmap::DashMap;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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
}


pub type StreamManager = Arc<DashMap<u32, StreamInfo>>; 

#[derive(Serialize, Clone, Debug)]
pub struct MqttMessage {
    pub topic: String,
    pub bytes: Bytes,
}

#[derive(Clone, Debug)]
pub struct FrameData {
    pub topic: String,
    pub buffer: Bytes,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub enum Protocol {
    MQTT,
    Udp,
    Lora,
    RTSP
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
    pub rtsp_frame_tx: broadcast::Sender<FrameData>,
}