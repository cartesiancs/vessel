use anyhow::{anyhow, Result};
use gstreamer::prelude::*;
use gstreamer_app::AppSrc;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{error, info, warn};
use webrtc::rtp::packet::Packet;
use webrtc::util::Marshal;

use crate::state::MediaType;

pub struct GstMuxer {
    pipeline: gstreamer::Pipeline,
    appsrc: AppSrc,
    media_type: MediaType,
    output_path: String,
    bytes_written: Arc<Mutex<u64>>,
}

impl GstMuxer {
    pub fn new(output_path: &str, media_type: MediaType, payload_type: u8) -> Result<Self> {
        gstreamer::init()?;

        let pipeline_str = match media_type {
            MediaType::Video => format!(
                "appsrc name=src format=3 is-live=true do-timestamp=true ! \
                 application/x-rtp,media=video,encoding-name=H264,clock-rate=90000,payload={} ! \
                 rtph264depay ! h264parse ! \
                 matroskamux ! filesink location={}",
                payload_type, output_path
            ),
            MediaType::Audio => format!(
                "appsrc name=src format=3 is-live=true do-timestamp=true ! \
                 application/x-rtp,media=audio,encoding-name=OPUS,clock-rate=48000,payload={} ! \
                 rtpopusdepay ! opusparse ! \
                 matroskamux ! filesink location={}",
                payload_type, output_path
            ),
        };

        let pipeline = gstreamer::parse::launch(&pipeline_str)?
            .downcast::<gstreamer::Pipeline>()
            .map_err(|_| anyhow!("Pipeline is not a Pipeline element"))?;

        let appsrc = pipeline
            .by_name("src")
            .ok_or_else(|| anyhow!("Failed to get appsrc element"))?
            .downcast::<AppSrc>()
            .map_err(|_| anyhow!("Element is not an AppSrc"))?;

        // Set appsrc properties
        appsrc.set_property("format", gstreamer::Format::Time);
        appsrc.set_property("is-live", true);

        Ok(Self {
            pipeline,
            appsrc,
            media_type,
            output_path: output_path.to_string(),
            bytes_written: Arc::new(Mutex::new(0)),
        })
    }

    pub fn start(&self) -> Result<()> {
        self.pipeline.set_state(gstreamer::State::Playing)?;
        info!("Recording pipeline started for {}", self.output_path);
        Ok(())
    }

    pub fn write_packet(&self, packet: &Packet) -> Result<()> {
        let data = packet.marshal()?;
        let mut buffer = gstreamer::Buffer::with_size(data.len())?;

        {
            let buffer_ref = buffer.get_mut().unwrap();
            let mut map = buffer_ref.map_writable()?;
            map.copy_from_slice(&data);
        }

        match self.appsrc.push_buffer(buffer) {
            Ok(_) => {
                // Track bytes written
                let bytes_written = self.bytes_written.clone();
                let data_len = data.len() as u64;
                tokio::spawn(async move {
                    let mut bw = bytes_written.lock().await;
                    *bw += data_len;
                });
                Ok(())
            }
            Err(e) => {
                warn!("Failed to push buffer to appsrc: {:?}", e);
                Err(anyhow!("Failed to push buffer: {:?}", e))
            }
        }
    }

    pub async fn get_bytes_written(&self) -> u64 {
        *self.bytes_written.lock().await
    }

    pub fn finalize(&self) -> Result<()> {
        info!("Finalizing recording for {}", self.output_path);

        // Send EOS to gracefully close the file
        self.appsrc.end_of_stream()?;

        // Wait for EOS to propagate
        let bus = self.pipeline.bus().unwrap();
        let timeout = gstreamer::ClockTime::from_seconds(5);

        for msg in bus.iter_timed(timeout) {
            use gstreamer::MessageView;
            match msg.view() {
                MessageView::Eos(_) => {
                    info!("EOS received, recording finalized: {}", self.output_path);
                    break;
                }
                MessageView::Error(err) => {
                    error!(
                        "Error while finalizing recording: {} ({:?})",
                        err.error(),
                        err.debug()
                    );
                    break;
                }
                _ => {}
            }
        }

        self.pipeline.set_state(gstreamer::State::Null)?;
        info!("Recording pipeline stopped for {}", self.output_path);
        Ok(())
    }

    pub fn output_path(&self) -> &str {
        &self.output_path
    }

    pub fn media_type(&self) -> MediaType {
        self.media_type
    }
}

impl Drop for GstMuxer {
    fn drop(&mut self) {
        if let Err(e) = self.pipeline.set_state(gstreamer::State::Null) {
            error!("Failed to set pipeline to Null state: {}", e);
        }
    }
}
