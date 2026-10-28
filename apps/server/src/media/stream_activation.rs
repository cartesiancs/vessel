use anyhow::{anyhow, Result};
use std::sync::Arc;
use tokio::sync::watch;
use tracing::{debug, info, warn};

use crate::db::{models::Stream, repository};
use crate::media::mjpeg_transcoder::{ingest_topic, MjpegTranscoderManager};
use crate::state::{DbPool, MediaType, Protocol, StreamCodec, StreamDescriptor, StreamManager};

#[derive(Clone, Debug)]
pub struct StreamActivation {
    pub ssrc: u32,
    pub topic: String,
    pub device_id: String,
    pub media_type: MediaType,
    pub codec: StreamCodec,
}

impl TryFrom<Stream> for StreamActivation {
    type Error = anyhow::Error;

    fn try_from(row: Stream) -> Result<Self> {
        let media_type = MediaType::from_db(&row.media_type)
            .ok_or_else(|| anyhow!("unknown media type '{}'", row.media_type))?;
        let codec = StreamCodec::from_db(&row.codec)
            .ok_or_else(|| anyhow!("unknown codec '{}'", row.codec))?;
        let ssrc = u32::try_from(row.ssrc).map_err(|_| anyhow!("negative SSRC {}", row.ssrc))?;
        Ok(Self {
            ssrc,
            topic: row.topic,
            device_id: row.device_id,
            media_type,
            codec,
        })
    }
}

/// Single place that turns a registered stream into live in-memory state, used by the
/// register API, boot-time hydration and RTP rehydration.
pub struct StreamActivator {
    streams: StreamManager,
    pool: DbPool,
    transcoders: MjpegTranscoderManager,
}

impl StreamActivator {
    pub fn new(streams: StreamManager, pool: DbPool, shutdown_rx: watch::Receiver<()>) -> Self {
        Self {
            transcoders: MjpegTranscoderManager::new(streams.clone(), shutdown_rx),
            streams,
            pool,
        }
    }

    /// Replaces any stream already live under the same topic and media type: a device that
    /// re-registers gets a new SSRC, and lookups by topic must not find the stale one.
    pub fn activate(&self, activation: StreamActivation) -> Result<()> {
        if !activation.codec.supports(activation.media_type) {
            return Err(anyhow!(
                "codec '{}' cannot carry {} streams",
                activation.codec.as_str(),
                activation.media_type.as_str()
            ));
        }

        match activation.codec {
            StreamCodec::Jpeg => self.activate_mjpeg(activation),
            StreamCodec::H264 | StreamCodec::Opus => {
                self.streams
                    .remove_by_topic(&activation.topic, activation.media_type);
                self.streams.register(StreamDescriptor {
                    id: activation.ssrc,
                    topic: activation.topic,
                    user_id: activation.device_id,
                    media_type: activation.media_type,
                    protocol: Protocol::Udp,
                });
                Ok(())
            }
        }
    }

    fn activate_mjpeg(&self, activation: StreamActivation) -> Result<()> {
        let ingest = ingest_topic(&activation.topic);
        self.transcoders.stop(&activation.topic);
        self.streams.remove_by_topic(&ingest, MediaType::Video);
        self.streams
            .remove_by_topic(&activation.topic, MediaType::Video);

        let handle = self.streams.register(StreamDescriptor {
            id: activation.ssrc,
            topic: ingest,
            user_id: activation.device_id.clone(),
            media_type: MediaType::Video,
            protocol: Protocol::Udp,
        });
        if let Err(e) = self
            .transcoders
            .start(&activation.topic, &activation.device_id, &handle)
        {
            self.streams.remove(&activation.ssrc);
            return Err(e);
        }
        Ok(())
    }

    /// Restores a stream whose SSRC was dropped by the idle checker while the device kept
    /// sending (e.g. after a network outage longer than the timeout).
    pub async fn rehydrate(self: Arc<Self>, ssrc: u32) {
        let Ok(db_ssrc) = i32::try_from(ssrc) else {
            return;
        };
        let pool = self.pool.clone();
        let lookup = tokio::task::spawn_blocking(move || {
            repository::streams::get_stream_by_ssrc(&pool, db_ssrc)
        })
        .await;
        let row = match lookup {
            Ok(Ok(Some(row))) => row,
            Ok(Ok(None)) => {
                debug!("Ignoring RTP from unregistered SSRC {}", ssrc);
                return;
            }
            Ok(Err(e)) => {
                warn!("Stream lookup for SSRC {} failed: {}", ssrc, e);
                return;
            }
            Err(e) => {
                warn!("Stream lookup task for SSRC {} failed: {}", ssrc, e);
                return;
            }
        };
        if self.streams.contains(ssrc) {
            return;
        }
        let activation = match StreamActivation::try_from(row) {
            Ok(activation) => activation,
            Err(e) => {
                warn!("Cannot rehydrate SSRC {}: {}", ssrc, e);
                return;
            }
        };
        let topic = activation.topic.clone();
        match self.activate(activation) {
            Ok(()) => info!(
                "Rehydrated stream '{}' (SSRC {}) from database",
                topic, ssrc
            ),
            Err(e) => warn!(
                "Failed to rehydrate stream '{}' (SSRC {}): {}",
                topic, ssrc, e
            ),
        }
    }
}
