use anyhow::{anyhow, Result};
use gstreamer::prelude::*;
use gstreamer_app::AppSrc;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{broadcast, watch, RwLock};
use tracing::{error, info, warn};
use webrtc::rtp::packet::Packet;
use webrtc::util::Marshal;

use crate::state::StreamHandle;

const HLS_TARGET_DURATION_SECS: u32 = 2;
const HLS_PLAYLIST_LENGTH: u32 = 6;
const HLS_MAX_FILES: u32 = 10;
const FIRST_PACKET_TIMEOUT_SECS: u64 = 5;
const PLAYLIST_READY_TIMEOUT_MS: u64 = 5000;
const PLAYLIST_POLL_INTERVAL_MS: u64 = 100;

pub struct HlsSession {
    pipeline: gstreamer::Pipeline,
    output_dir: PathBuf,
    playlist_path: PathBuf,
    last_access: Arc<RwLock<Instant>>,
    shutdown_tx: watch::Sender<()>,
}

impl HlsSession {
    /// Spawn a GStreamer pipeline that consumes RTP packets from the given
    /// stream handle and produces an HLS playlist + segments under `output_dir`.
    /// Blocks until the playlist file appears or the timeout expires.
    pub async fn start(stream_handle: StreamHandle, output_dir: PathBuf) -> Result<Self> {
        gstreamer::init()?;

        std::fs::create_dir_all(&output_dir)?;
        let playlist_path = output_dir.join("playlist.m3u8");

        let mut packet_rx = stream_handle.packet_tx.subscribe();
        let topic = stream_handle.descriptor.topic.clone();

        let first_packet = wait_for_first_packet(&mut packet_rx, &topic).await?;
        let payload_type = first_packet.header.payload_type;

        let pipeline = build_pipeline(&output_dir, payload_type)?;
        let appsrc = pipeline
            .by_name("src")
            .ok_or_else(|| anyhow!("HLS pipeline missing appsrc"))?
            .downcast::<AppSrc>()
            .map_err(|_| anyhow!("HLS pipeline 'src' is not an AppSrc"))?;
        appsrc.set_property("format", gstreamer::Format::Time);
        appsrc.set_property("is-live", true);

        pipeline.set_state(gstreamer::State::Playing)?;

        push_packet(&appsrc, &first_packet)?;

        let (shutdown_tx, shutdown_rx) = watch::channel(());
        let appsrc_for_task = appsrc.clone();
        let pipeline_for_task = pipeline.clone();
        let topic_for_task = topic.clone();

        tokio::spawn(async move {
            run_pump(appsrc_for_task, packet_rx, shutdown_rx, topic_for_task).await;
            if let Err(e) = pipeline_for_task.set_state(gstreamer::State::Null) {
                error!("HLS pipeline shutdown failed: {}", e);
            }
        });

        wait_for_playlist(&playlist_path).await?;

        info!(
            "HLS session started for topic '{}' at {}",
            topic,
            playlist_path.display()
        );

        Ok(Self {
            pipeline,
            output_dir,
            playlist_path,
            last_access: Arc::new(RwLock::new(Instant::now())),
            shutdown_tx,
        })
    }

    pub fn playlist_path(&self) -> &PathBuf {
        &self.playlist_path
    }

    pub fn output_dir(&self) -> &PathBuf {
        &self.output_dir
    }

    pub async fn touch(&self) {
        let mut guard = self.last_access.write().await;
        *guard = Instant::now();
    }

    pub async fn idle_for(&self) -> std::time::Duration {
        let guard = self.last_access.read().await;
        guard.elapsed()
    }

    pub fn shutdown(&self) {
        self.shutdown_tx.send(()).ok();
    }
}

impl Drop for HlsSession {
    fn drop(&mut self) {
        self.shutdown_tx.send(()).ok();
        if let Err(e) = self.pipeline.set_state(gstreamer::State::Null) {
            error!("HLS pipeline drop failed: {}", e);
        }
        if self.output_dir.exists() {
            if let Err(e) = std::fs::remove_dir_all(&self.output_dir) {
                warn!(
                    "Failed to remove HLS dir {}: {}",
                    self.output_dir.display(),
                    e
                );
            }
        }
    }
}

fn build_pipeline(output_dir: &PathBuf, payload_type: u8) -> Result<gstreamer::Pipeline> {
    let dir_str = output_dir
        .to_str()
        .ok_or_else(|| anyhow!("HLS output dir is not valid UTF-8"))?;

    let pipeline_str = format!(
        "appsrc name=src format=3 is-live=true do-timestamp=true ! \
         application/x-rtp,media=video,encoding-name=H264,clock-rate=90000,payload={pt} ! \
         rtph264depay ! h264parse config-interval=-1 ! \
         video/x-h264,stream-format=byte-stream,alignment=au ! \
         hlssink2 name=sink \
           location={dir}/seg_%05d.ts \
           playlist-location={dir}/playlist.m3u8 \
           target-duration={target} \
           playlist-length={plen} \
           max-files={maxf} \
           send-keyframe-requests=true",
        pt = payload_type,
        dir = dir_str,
        target = HLS_TARGET_DURATION_SECS,
        plen = HLS_PLAYLIST_LENGTH,
        maxf = HLS_MAX_FILES,
    );

    let pipeline = gstreamer::parse::launch(&pipeline_str)
        .map_err(|e| anyhow!("Failed to build HLS pipeline (is gst-plugins-bad installed?): {}", e))?
        .downcast::<gstreamer::Pipeline>()
        .map_err(|_| anyhow!("HLS launch returned non-Pipeline element"))?;

    Ok(pipeline)
}

async fn wait_for_first_packet(
    rx: &mut broadcast::Receiver<Packet>,
    topic: &str,
) -> Result<Packet> {
    let deadline = tokio::time::Instant::now()
        + tokio::time::Duration::from_secs(FIRST_PACKET_TIMEOUT_SECS);

    loop {
        let remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        if remaining.is_zero() {
            return Err(anyhow!(
                "Timed out waiting for first RTP packet on topic '{}'",
                topic
            ));
        }
        match tokio::time::timeout(remaining, rx.recv()).await {
            Ok(Ok(packet)) => return Ok(packet),
            Ok(Err(broadcast::error::RecvError::Lagged(n))) => {
                warn!("HLS lagged {} packets while waiting on '{}'", n, topic);
            }
            Ok(Err(broadcast::error::RecvError::Closed)) => {
                return Err(anyhow!(
                    "Stream closed before first packet on topic '{}'",
                    topic
                ));
            }
            Err(_) => {
                return Err(anyhow!(
                    "Timed out waiting for first RTP packet on topic '{}'",
                    topic
                ));
            }
        }
    }
}

fn push_packet(appsrc: &AppSrc, packet: &Packet) -> Result<()> {
    let data = packet.marshal()?;
    let mut buffer = gstreamer::Buffer::with_size(data.len())?;
    {
        let buf_ref = buffer
            .get_mut()
            .ok_or_else(|| anyhow!("Failed to get mutable buffer ref"))?;
        let mut map = buf_ref.map_writable()?;
        map.copy_from_slice(&data);
    }
    appsrc
        .push_buffer(buffer)
        .map_err(|e| anyhow!("Failed to push RTP buffer to HLS appsrc: {:?}", e))?;
    Ok(())
}

async fn run_pump(
    appsrc: AppSrc,
    mut rx: broadcast::Receiver<Packet>,
    mut shutdown_rx: watch::Receiver<()>,
    topic: String,
) {
    loop {
        tokio::select! {
            _ = shutdown_rx.changed() => {
                info!("HLS pump shutdown for topic '{}'", topic);
                break;
            }
            recv = rx.recv() => {
                match recv {
                    Ok(packet) => {
                        if let Err(e) = push_packet(&appsrc, &packet) {
                            warn!("HLS push_packet failed for '{}': {}", topic, e);
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        warn!("HLS pump lagged {} packets for '{}'", n, topic);
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        info!("HLS source closed for '{}'", topic);
                        break;
                    }
                }
            }
        }
    }

    if let Err(e) = appsrc.end_of_stream() {
        warn!("HLS appsrc EOS failed for '{}': {:?}", topic, e);
    }
}

async fn wait_for_playlist(playlist_path: &PathBuf) -> Result<()> {
    let deadline = tokio::time::Instant::now()
        + tokio::time::Duration::from_millis(PLAYLIST_READY_TIMEOUT_MS);

    while tokio::time::Instant::now() < deadline {
        if playlist_path.exists() {
            if let Ok(meta) = std::fs::metadata(playlist_path) {
                if meta.len() > 0 {
                    return Ok(());
                }
            }
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(PLAYLIST_POLL_INTERVAL_MS)).await;
    }

    Err(anyhow!(
        "HLS playlist did not appear at {} within {} ms",
        playlist_path.display(),
        PLAYLIST_READY_TIMEOUT_MS
    ))
}
