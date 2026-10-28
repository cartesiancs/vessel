use anyhow::{anyhow, Result};
use tokio::sync::watch;

use crate::db::models::Stream;
use crate::media::mjpeg_transcoder::{ingest_topic, MjpegTranscoderManager};
use crate::state::{MediaType, Protocol, StreamCodec, StreamDescriptor, StreamManager};

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
/// register API and boot-time hydration.
pub struct StreamActivator {
    streams: StreamManager,
    transcoders: MjpegTranscoderManager,
}

impl StreamActivator {
    pub fn new(streams: StreamManager, shutdown_rx: watch::Receiver<()>) -> Self {
        Self {
            transcoders: MjpegTranscoderManager::new(streams.clone(), shutdown_rx),
            streams,
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
}
