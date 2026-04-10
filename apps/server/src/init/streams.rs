use tokio::sync::broadcast;
use tracing::{error, info, warn};
use webrtc::rtp::packet::Packet;

use crate::db::repository;
use crate::state::{DbPool, MediaType, Protocol, StreamDescriptor, StreamManager};

pub fn create_hydrate_streams(pool: &DbPool, streams: &StreamManager) {
    info!("Hydrating streams from database...");
    match repository::streams::get_all_streams(&pool) {
        Ok(db_streams) => {
            for stream in db_streams {
                let (packet_tx, _) = broadcast::channel::<Packet>(8192);
                let media_type = match stream.media_type.as_str() {
                    "audio" => MediaType::Audio,
                    "video" => MediaType::Video,
                    _ => {
                        warn!(
                            "Unknown media type '{}' for SSRC {}",
                            stream.media_type, stream.ssrc
                        );
                        continue;
                    }
                };

                let descriptor = StreamDescriptor {
                    id: stream.ssrc as u32,
                    topic: stream.topic,
                    user_id: stream.device_id,
                    media_type,
                    protocol: Protocol::Udp,
                };

                streams.insert_with_sender(descriptor, packet_tx);
            }
            info!("Hydrated {} streams into memory.", streams.len());
        }
        Err(e) => {
            error!("Failed to hydrate streams from database: {}", e);
        }
    }
}
