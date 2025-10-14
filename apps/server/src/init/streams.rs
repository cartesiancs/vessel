use std::sync::Arc;

use dashmap::DashMap;
use diesel::{
    ExpressionMethods, OptionalExtension, QueryDsl, RunQueryDsl, SelectableHelper, SqliteConnection,
};
use rtp::packet::Packet;
use tokio::sync::{broadcast, RwLock};
use tokio::time::Instant;
use tracing::{error, info, warn};

use crate::db::models::{NewPermission, Permission, User};
use crate::db::models::{NewSystemConfiguration, NewUser, SystemConfiguration};
use crate::db::repository::{self, streams};
use crate::lib::hash::hash_password;
use crate::state::{DbPool, MediaType, StreamInfo};

pub fn create_hydrate_streams(pool: &DbPool, streams: &Arc<DashMap<u32, StreamInfo>>) {
    info!("Hydrating streams from database...");
    match repository::streams::get_all_streams(&pool) {
        Ok(db_streams) => {
            for stream in db_streams {
                let (packet_tx, _) = broadcast::channel::<Packet>(1024);
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

                let stream_info = StreamInfo {
                    topic: stream.topic,
                    user_id: stream.device_id,
                    packet_tx,
                    media_type,
                    last_seen: Arc::new(std::sync::RwLock::new(Instant::now())),
                    is_online: Arc::new(std::sync::RwLock::new(false)),
                };
                streams.insert(stream.ssrc as u32, stream_info);
            }
            info!("Hydrated {} streams into memory.", streams.len());
        }
        Err(e) => {
            error!("Failed to hydrate streams from database: {}", e);
        }
    }
}
