use bytes::Bytes;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::{broadcast, mpsc, watch, RwLock};
use tokio::time::Instant;
use webrtc::rtp::packet::Packet;

use diesel::r2d2::{self, ConnectionManager};
use diesel::sqlite::SqliteConnection;

pub type DbPool = r2d2::Pool<ConnectionManager<SqliteConnection>>;

use dashmap::DashMap;

use crate::flow::manager_state::FlowManagerCommand;
use crate::map::MapStore;
use crate::recording::RecordingManager;
use crate::streaming::HlsManager;
use crate::{db::models::SystemConfiguration, tunnel_control::TunnelManager};

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaType {
    Audio,
    Video,
}

impl MediaType {
    pub fn as_str(self) -> &'static str {
        match self {
            MediaType::Audio => "audio",
            MediaType::Video => "video",
        }
    }

    pub fn from_db(value: &str) -> Option<Self> {
        match value {
            "audio" => Some(MediaType::Audio),
            "video" => Some(MediaType::Video),
            _ => None,
        }
    }
}

/// Payload format a device pushes over RTP. `Jpeg` (RFC 2435) is transcoded to H.264 on the
/// server because every consumer (WebRTC, HLS, recording) expects H.264.
#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum StreamCodec {
    #[default]
    H264,
    Jpeg,
    Opus,
}

impl StreamCodec {
    pub fn as_str(self) -> &'static str {
        match self {
            StreamCodec::H264 => "h264",
            StreamCodec::Jpeg => "jpeg",
            StreamCodec::Opus => "opus",
        }
    }

    pub fn from_db(value: &str) -> Option<Self> {
        match value {
            "h264" => Some(StreamCodec::H264),
            "jpeg" => Some(StreamCodec::Jpeg),
            "opus" => Some(StreamCodec::Opus),
            _ => None,
        }
    }

    pub fn supports(self, media_type: MediaType) -> bool {
        matches!(
            (self, media_type),
            (StreamCodec::H264, MediaType::Video)
                | (StreamCodec::Jpeg, MediaType::Video)
                | (StreamCodec::Opus, MediaType::Audio)
        )
    }
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
            // A re-registered stream reuses the topic under a new SSRC; only drop the index
            // entry if it still points at the stream being removed.
            self.topic_index
                .remove_if(&handle.descriptor.topic, |_, indexed| indexed == ssrc);
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

/// Dynamic dashboard widgets → running flows (via `DASHBOARD_EVENT_LISTENER` nodes).
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DashboardUiEvent {
    pub listener_id: String,
    pub event_id: String,
    #[serde(default)]
    pub occurred_at: Option<String>,
    #[serde(default)]
    pub dashboard_id: Option<String>,
    #[serde(default)]
    pub group_id: Option<String>,
    #[serde(default)]
    pub item_id: Option<String>,
    pub component_type: String,
    pub action: String,
    #[serde(default)]
    pub value: Option<Value>,
    pub source_session_id: String,
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
    pub dashboard_ui_tx: broadcast::Sender<DashboardUiEvent>,
    pub broadcast_tx: broadcast::Sender<String>,
    pub system_configs: Vec<SystemConfiguration>,
    pub tunnel_manager: Arc<TunnelManager>,
    pub recording_manager: Arc<RecordingManager>,
    pub hls_manager: Arc<HlsManager>,
    pub map_store: Arc<MapStore>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn descriptor(id: u32, topic: &str, media_type: MediaType) -> StreamDescriptor {
        StreamDescriptor {
            id,
            topic: topic.to_string(),
            user_id: "device".to_string(),
            media_type,
            protocol: Protocol::Udp,
        }
    }

    #[test]
    fn removing_stale_ssrc_keeps_topic_index_of_reregistered_stream() {
        let registry = StreamRegistry::new();
        registry.register(descriptor(1, "cam/video", MediaType::Video));
        registry.register(descriptor(2, "cam/video", MediaType::Video));

        registry.remove(&1);

        let current = registry.get_by_topic("cam/video").map(|h| h.descriptor.id);
        assert_eq!(current, Some(2));
    }

    #[test]
    fn codec_media_type_compatibility() {
        assert!(StreamCodec::Jpeg.supports(MediaType::Video));
        assert!(StreamCodec::H264.supports(MediaType::Video));
        assert!(StreamCodec::Opus.supports(MediaType::Audio));
        assert!(!StreamCodec::Opus.supports(MediaType::Video));
        assert!(!StreamCodec::Jpeg.supports(MediaType::Audio));
    }
}
