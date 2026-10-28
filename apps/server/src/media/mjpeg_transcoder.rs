use anyhow::{anyhow, Context, Result};
use dashmap::DashMap;
use futures_util::StreamExt;
use gstreamer::prelude::*;
use gstreamer_app::{AppSink, AppSinkCallbacks, AppSrc};
use rand::Rng;
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use tokio::sync::{broadcast, watch};
use tracing::{error, info, warn};
use webrtc::rtp::packet::Packet;
use webrtc::util::{Marshal, Unmarshal};

use crate::state::{MediaType, Protocol, StreamDescriptor, StreamHandle, StreamManager};

/// Suffix of the internal topic that carries the raw RFC 2435 packets. The user-facing topic
/// is reserved for the transcoded H.264 stream, because WebRTC looks streams up by topic.
pub const MJPEG_INGEST_SUFFIX: &str = "::mjpeg";

const INGEST_CAPS: &str =
    "application/x-rtp,media=video,encoding-name=JPEG,payload=26,clock-rate=90000";
const JITTER_LATENCY_MS: u32 = 50;
const APPSRC_MAX_BYTES: u64 = 4 * 1024 * 1024;
const H264_PAYLOAD_TYPE: u8 = 96;
const RTP_MTU: u32 = 1200;
const KEYFRAME_INTERVAL_FRAMES: u32 = 30;
const TARGET_BITRATE_KBPS: u32 = 2000;
const BITS_PER_KBIT: u32 = 1000;
const OUTPUT_CHANNEL_CAPACITY: usize = 8192;
const SSRC_ALLOCATION_ATTEMPTS: usize = 16;

pub fn ingest_topic(topic: &str) -> String {
    format!("{topic}{MJPEG_INGEST_SUFFIX}")
}

struct RunningTranscoder {
    id: u64,
    stop_tx: watch::Sender<()>,
}

pub struct MjpegTranscoderManager {
    streams: StreamManager,
    running: Arc<DashMap<String, RunningTranscoder>>,
    shutdown_rx: watch::Receiver<()>,
    next_id: AtomicU64,
}

impl MjpegTranscoderManager {
    pub fn new(streams: StreamManager, shutdown_rx: watch::Receiver<()>) -> Self {
        Self {
            streams,
            running: Arc::new(DashMap::new()),
            shutdown_rx,
            next_id: AtomicU64::new(0),
        }
    }

    /// Starts transcoding `ingest` into an H.264 stream published under `topic`, replacing any
    /// transcoder already running for that topic.
    pub fn start(&self, topic: &str, user_id: &str, ingest: &StreamHandle) -> Result<()> {
        gstreamer::init().context("failed to initialize GStreamer")?;
        let encoder = select_encoder()?;
        let out_ssrc = allocate_ssrc(&self.streams)?;
        let (pipeline, appsrc, appsink) = build_pipeline(&encoder, out_ssrc)?;

        let descriptor = StreamDescriptor {
            id: out_ssrc,
            topic: topic.to_string(),
            user_id: user_id.to_string(),
            media_type: MediaType::Video,
            protocol: Protocol::Udp,
        };
        install_output_callback(&appsink, descriptor, self.streams.clone());

        self.stop(topic);
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let (stop_tx, stop_rx) = watch::channel(());
        self.running
            .insert(topic.to_string(), RunningTranscoder { id, stop_tx });

        let task = TranscoderTask {
            id,
            topic: topic.to_string(),
            ingest_ssrc: ingest.descriptor.id,
            out_ssrc,
            pipeline,
            appsrc,
            packet_rx: ingest.packet_tx.subscribe(),
            stop_rx,
            shutdown_rx: self.shutdown_rx.clone(),
            streams: self.streams.clone(),
            running: self.running.clone(),
        };
        info!(
            "MJPEG transcoder for '{}' started (ingest SSRC {}, output SSRC {}, encoder {})",
            topic,
            ingest.descriptor.id,
            out_ssrc,
            encoder.split_whitespace().next().unwrap_or("?")
        );
        tokio::spawn(task.run());
        Ok(())
    }

    pub fn stop(&self, topic: &str) {
        if let Some((_, running)) = self.running.remove(topic) {
            // The task may have exited already; a closed channel needs no signal.
            let _ = running.stop_tx.send(());
        }
    }
}

fn select_encoder() -> Result<String> {
    if gstreamer::ElementFactory::find("x264enc").is_some() {
        return Ok(format!(
            "x264enc tune=zerolatency speed-preset=ultrafast key-int-max={KEYFRAME_INTERVAL_FRAMES} \
             bitrate={TARGET_BITRATE_KBPS} byte-stream=true"
        ));
    }
    if gstreamer::ElementFactory::find("openh264enc").is_some() {
        return Ok(format!(
            "openh264enc complexity=low rate-control=bitrate bitrate={} gop-size={KEYFRAME_INTERVAL_FRAMES}",
            TARGET_BITRATE_KBPS * BITS_PER_KBIT
        ));
    }
    Err(anyhow!(
        "no H.264 encoder available: install the GStreamer x264enc (plugins-ugly) or openh264enc (plugins-bad) element"
    ))
}

fn allocate_ssrc(streams: &StreamManager) -> Result<u32> {
    let mut rng = rand::rng();
    for _ in 0..SSRC_ALLOCATION_ATTEMPTS {
        let candidate = rng.random_range(0..=i32::MAX as u32);
        if !streams.contains(candidate) {
            return Ok(candidate);
        }
    }
    Err(anyhow!("could not allocate a free output SSRC"))
}

fn build_pipeline(encoder: &str, out_ssrc: u32) -> Result<(gstreamer::Pipeline, AppSrc, AppSink)> {
    let description = format!(
        "appsrc name=src is-live=true format=time do-timestamp=true max-bytes={APPSRC_MAX_BYTES} \
           leaky-type=downstream caps=\"{INGEST_CAPS}\" \
         ! rtpjitterbuffer latency={JITTER_LATENCY_MS} drop-on-latency=true \
         ! rtpjpegdepay ! jpegdec ! videoconvert ! video/x-raw,format=I420 \
         ! {encoder} \
         ! video/x-h264,profile=constrained-baseline,stream-format=byte-stream \
         ! rtph264pay config-interval=-1 pt={H264_PAYLOAD_TYPE} ssrc={out_ssrc} mtu={RTP_MTU} \
           aggregate-mode=zero-latency \
         ! appsink name=sink sync=false"
    );
    let pipeline = gstreamer::parse::launch(&description)
        .context("failed to build MJPEG transcoder pipeline")?
        .downcast::<gstreamer::Pipeline>()
        .map_err(|_| anyhow!("transcoder pipeline is not a Pipeline"))?;
    let appsrc = pipeline
        .by_name("src")
        .ok_or_else(|| anyhow!("transcoder pipeline has no appsrc"))?
        .downcast::<AppSrc>()
        .map_err(|_| anyhow!("'src' is not an AppSrc"))?;
    let appsink = pipeline
        .by_name("sink")
        .ok_or_else(|| anyhow!("transcoder pipeline has no appsink"))?
        .downcast::<AppSink>()
        .map_err(|_| anyhow!("'sink' is not an AppSink"))?;
    Ok((pipeline, appsrc, appsink))
}

fn install_output_callback(
    appsink: &AppSink,
    descriptor: StreamDescriptor,
    streams: StreamManager,
) {
    let (packet_tx, _) = broadcast::channel::<Packet>(OUTPUT_CHANNEL_CAPACITY);
    let out_ssrc = descriptor.id;
    appsink.set_callbacks(
        AppSinkCallbacks::builder()
            .new_sample(move |sink| {
                let sample = sink.pull_sample().map_err(|_| gstreamer::FlowError::Eos)?;
                let buffer = sample.buffer().ok_or(gstreamer::FlowError::Error)?;
                let map = buffer
                    .map_readable()
                    .map_err(|_| gstreamer::FlowError::Error)?;
                let packet = match Packet::unmarshal(&mut map.as_slice()) {
                    Ok(packet) => packet,
                    Err(e) => {
                        warn!("Transcoder produced an invalid RTP packet: {}", e);
                        return Ok(gstreamer::FlowSuccess::Ok);
                    }
                };
                // Re-insert after the 10 s idle checker dropped the handle (e.g. the camera
                // paused), so the topic comes back without a new registration.
                if !streams.contains(out_ssrc) {
                    streams.insert_with_sender(descriptor.clone(), packet_tx.clone());
                }
                streams.mark_online(out_ssrc);
                // No subscribers yet is normal; the packet is simply not delivered.
                let _ = packet_tx.send(packet);
                Ok(gstreamer::FlowSuccess::Ok)
            })
            .build(),
    );
}

struct TranscoderTask {
    id: u64,
    topic: String,
    ingest_ssrc: u32,
    out_ssrc: u32,
    pipeline: gstreamer::Pipeline,
    appsrc: AppSrc,
    packet_rx: broadcast::Receiver<Packet>,
    stop_rx: watch::Receiver<()>,
    shutdown_rx: watch::Receiver<()>,
    streams: StreamManager,
    running: Arc<DashMap<String, RunningTranscoder>>,
}

impl TranscoderTask {
    async fn run(mut self) {
        if let Err(e) = self.drive().await {
            error!(
                "MJPEG transcoder for '{}' (ingest SSRC {}) failed: {}",
                self.topic, self.ingest_ssrc, e
            );
        }
        if let Err(e) = self.pipeline.set_state(gstreamer::State::Null) {
            warn!(
                "Failed to stop MJPEG transcoder pipeline for '{}': {}",
                self.topic, e
            );
        }
        // Only after the pipeline is stopped, so no late callback re-inserts the handle.
        self.streams.remove(&self.out_ssrc);
        let id = self.id;
        self.running
            .remove_if(&self.topic, |_, running| running.id == id);
        info!(
            "MJPEG transcoder for '{}' (ingest SSRC {}) stopped",
            self.topic, self.ingest_ssrc
        );
    }

    async fn drive(&mut self) -> Result<()> {
        self.pipeline
            .set_state(gstreamer::State::Playing)
            .context("failed to start pipeline")?;
        let bus = self
            .pipeline
            .bus()
            .ok_or_else(|| anyhow!("pipeline has no bus"))?;
        let mut bus_stream = bus.stream();

        loop {
            tokio::select! {
                _ = self.stop_rx.changed() => return Ok(()),
                _ = self.shutdown_rx.changed() => return Ok(()),
                received = self.packet_rx.recv() => match received {
                    Ok(packet) => push_packet(&self.appsrc, &packet)?,
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        warn!("MJPEG transcoder for '{}' lagged, skipped {} packets", self.topic, skipped);
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        info!(
                            "Ingest stream for '{}' (SSRC {}) closed",
                            self.topic, self.ingest_ssrc
                        );
                        return Ok(());
                    }
                },
                message = bus_stream.next() => {
                    let Some(message) = message else {
                        return Err(anyhow!("pipeline bus closed"));
                    };
                    match message.view() {
                        gstreamer::MessageView::Error(err) => {
                            return Err(anyhow!(
                                "{} ({})",
                                err.error(),
                                err.debug().unwrap_or_default()
                            ));
                        }
                        gstreamer::MessageView::Eos(_) => return Ok(()),
                        _ => {}
                    }
                }
            }
        }
    }
}

fn push_packet(appsrc: &AppSrc, packet: &Packet) -> Result<()> {
    let bytes = packet.marshal().context("failed to serialize RTP packet")?;
    appsrc
        .push_buffer(gstreamer::Buffer::from_slice(bytes))
        .map_err(|e| anyhow!("appsrc rejected buffer: {:?}", e))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ingest_topic_appends_reserved_suffix() {
        assert_eq!(ingest_topic("cam/front/video"), "cam/front/video::mjpeg");
    }
}
