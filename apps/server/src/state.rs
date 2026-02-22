use bytes::Bytes;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, watch, RwLock};
use tokio::time::Instant;
use webrtc::rtp::packet::Packet;

use diesel::r2d2::{self, ConnectionManager};
use diesel::sqlite::SqliteConnection;

pub type DbPool = r2d2::Pool<ConnectionManager<SqliteConnection>>;

use dashmap::DashMap;

use crate::flow::manager_state::FlowManagerCommand;
use crate::recording::RecordingManager;
use crate::{db::models::SystemConfiguration, tunnel_control::TunnelManager};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Audio,
    Video,
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
pub enum Protocol {
    MQTT,
    Udp,
    Lora,
    RTSP,
    Http,
    HomeAssistant,
    Ros2,
    Sdrpp,
}

#[derive(Clone, Debug)]
pub struct StreamDescriptor {
    pub id: u32,
    pub topic: String,
    pub user_id: String,
    pub media_type: MediaType,
    pub protocol: Protocol,
}

#[derive(Clone, Debug)]
pub struct StreamHandle {
    pub descriptor: StreamDescriptor,
    pub packet_tx: broadcast::Sender<Packet>,
    pub last_seen: Arc<std::sync::RwLock<Instant>>,
    pub is_online: Arc<std::sync::RwLock<bool>>,
}

#[derive(Default)]
pub struct StreamRegistry {
    streams: DashMap<u32, StreamHandle>,
    topic_index: DashMap<String, u32>,
}

impl StreamRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, descriptor: StreamDescriptor) -> StreamHandle {
        let (packet_tx, _) = broadcast::channel::<Packet>(8192);
        self.insert_with_sender(descriptor, packet_tx)
    }

    pub fn insert_with_sender(
        &self,
        descriptor: StreamDescriptor,
        packet_tx: broadcast::Sender<Packet>,
    ) -> StreamHandle {
        let handle = StreamHandle {
            descriptor: descriptor.clone(),
            packet_tx,
            last_seen: Arc::new(std::sync::RwLock::new(Instant::now())),
            is_online: Arc::new(std::sync::RwLock::new(false)),
        };

        self.topic_index
            .insert(descriptor.topic.clone(), descriptor.id);
        self.streams.insert(descriptor.id, handle.clone());
        handle
    }

    pub fn get_by_ssrc(&self, ssrc: u32) -> Option<StreamHandle> {
        self.streams.get(&ssrc).map(|h| h.clone())
    }

    pub fn get_by_topic(&self, topic: &str) -> Option<StreamHandle> {
        self.topic_index
            .get(topic)
            .and_then(|entry| self.get_by_ssrc(*entry.value()))
    }

    pub fn mark_online(&self, ssrc: u32) {
        if let Some(handle) = self.streams.get(&ssrc) {
            if let Ok(mut is_online) = handle.is_online.write() {
                *is_online = true;
            }
            if let Ok(mut last_seen) = handle.last_seen.write() {
                *last_seen = Instant::now();
            }
        }
    }

    pub fn update_last_seen(&self, ssrc: u32) {
        if let Some(handle) = self.streams.get(&ssrc) {
            if let Ok(mut last_seen) = handle.last_seen.write() {
                *last_seen = Instant::now();
            }
        }
    }

    pub fn iter(&self) -> dashmap::iter::Iter<'_, u32, StreamHandle> {
        self.streams.iter()
    }

    pub fn remove(&self, ssrc: &u32) -> Option<(u32, StreamHandle)> {
        if let Some((key, handle)) = self.streams.remove(ssrc) {
            self.topic_index.remove(&handle.descriptor.topic);
            Some((key, handle))
        } else {
            None
        }
    }

    pub fn len(&self) -> usize {
        self.streams.len()
    }
}

pub type StreamManager = Arc<StreamRegistry>;

#[derive(Serialize, Clone, Debug)]
pub struct MqttMessage {
    pub topic: String,
    pub bytes: Bytes,
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
    /// Notifies subscribers when topic_map has been updated
    pub topic_map_notify: watch::Sender<()>,
    pub flow_manager_tx: mpsc::Sender<FlowManagerCommand>,
    pub broadcast_tx: broadcast::Sender<String>,
    pub system_configs: Vec<SystemConfiguration>,
    pub tunnel_manager: Arc<TunnelManager>,
    pub recording_manager: Arc<RecordingManager>,
}
