use anyhow::Result;
use chrono::Utc;
use std::path::PathBuf;
use std::time::Instant;
use tokio::sync::{broadcast, watch};
use tracing::{error, info, warn};
use webrtc::rtp::packet::Packet;

use crate::db::models::UpdateRecording;
use crate::db::repository::recordings as recordings_repo;
use crate::recording::muxer::GstMuxer;
use crate::state::{DbPool, MediaType, StreamHandle};

pub struct RecordingService {
    recording_id: i32,
    stream_handle: StreamHandle,
    output_path: PathBuf,
    pool: DbPool,
    media_type: MediaType,
}

impl RecordingService {
    pub fn new(
        recording_id: i32,
        stream_handle: StreamHandle,
        output_path: PathBuf,
        pool: DbPool,
        media_type: MediaType,
    ) -> Self {
        Self {
            recording_id,
            stream_handle,
            output_path,
            pool,
            media_type,
        }
    }

    pub async fn run(&self, mut shutdown_rx: watch::Receiver<()>) -> Result<()> {
        info!(
            "Starting recording service for recording_id={}, topic={}",
            self.recording_id, self.stream_handle.descriptor.topic
        );

        // Subscribe to stream's broadcast channel
        let mut packet_rx = self.stream_handle.packet_tx.subscribe();

        // Wait for first packet to extract payload type
        let first_packet: Packet;
        loop {
            tokio::select! {
                _ = shutdown_rx.changed() => {
                    info!("Shutdown signal received before first packet for recording_id={}", self.recording_id);
                    self.update_recording_failed("Shutdown before receiving any packets")?;
                    return Ok(());
                }
                result = packet_rx.recv() => {
                    match result {
                        Ok(packet) => {
                            first_packet = packet;
                            break;
                        }
                        Err(broadcast::error::RecvError::Lagged(n)) => {
                            warn!("Recording lagged {} packets while waiting for first packet", n);
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            info!("Broadcast channel closed before first packet for recording_id={}", self.recording_id);
                            self.update_recording_failed("Stream closed before receiving any packets")?;
                            return Ok(());
                        }
                    }
                }
            }
        }

        // Extract payload type from first packet
        let payload_type = first_packet.header.payload_type;
        info!(
            "First packet received for recording_id={}, payload_type={}",
            self.recording_id, payload_type
        );

        // Initialize GStreamer muxer with correct payload type
        let muxer = match GstMuxer::new(
            self.output_path.to_str().unwrap(),
            self.media_type,
            payload_type,
        ) {
            Ok(m) => m,
            Err(e) => {
                error!("Failed to initialize muxer: {}", e);
                self.update_recording_failed(&format!("Muxer init failed: {}", e))?;
                return Err(e);
            }
        };

        if let Err(e) = muxer.start() {
            error!("Failed to start muxer: {}", e);
            self.update_recording_failed(&format!("Muxer start failed: {}", e))?;
            return Err(e);
        }

        // Write the first packet
        let start_time = Instant::now();
        let mut packet_count: u64 = 0;
        let mut last_log_time = Instant::now();

        if let Err(e) = muxer.write_packet(&first_packet) {
            warn!("Failed to write first packet: {}", e);
        } else {
            packet_count += 1;
        }

        loop {
            tokio::select! {
                _ = shutdown_rx.changed() => {
                    info!("Shutdown signal received for recording_id={}", self.recording_id);
                    break;
                }
                result = packet_rx.recv() => {
                    match result {
                        Ok(packet) => {
                            if let Err(e) = muxer.write_packet(&packet) {
                                warn!("Failed to write packet: {}", e);
                            } else {
                                packet_count += 1;
                            }

                            // Log progress every 30 seconds
                            if last_log_time.elapsed().as_secs() >= 30 {
                                info!(
                                    "Recording in progress: id={}, packets={}, duration={}s",
                                    self.recording_id,
                                    packet_count,
                                    start_time.elapsed().as_secs()
                                );
                                last_log_time = Instant::now();
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(n)) => {
                            warn!("Recording lagged {} packets for recording_id={}", n, self.recording_id);
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            info!("Broadcast channel closed for recording_id={}", self.recording_id);
                            break;
                        }
                    }
                }
            }
        }

        // Finalize recording
        info!("Finalizing recording_id={}", self.recording_id);
        if let Err(e) = muxer.finalize() {
            error!("Failed to finalize muxer: {}", e);
        }

        // Calculate duration and file size
        let duration_ms = start_time.elapsed().as_millis() as i32;
        let file_size = std::fs::metadata(&self.output_path)
            .map(|m| m.len() as i32)
            .unwrap_or(0);

        // Update recording in database
        self.update_recording_completed(duration_ms, file_size)?;

        info!(
            "Recording completed: id={}, duration={}ms, size={} bytes, packets={}",
            self.recording_id, duration_ms, file_size, packet_count
        );

        Ok(())
    }

    fn update_recording_completed(&self, duration_ms: i32, file_size: i32) -> Result<()> {
        let update = UpdateRecording {
            status: Some("completed".to_string()),
            ended_at: Some(Utc::now().naive_utc()),
            duration_ms: Some(duration_ms),
            file_size: Some(file_size),
        };

        recordings_repo::update_recording(&self.pool, self.recording_id, &update)?;
        Ok(())
    }

    fn update_recording_failed(&self, error_msg: &str) -> Result<()> {
        let update = UpdateRecording {
            status: Some("failed".to_string()),
            ended_at: Some(Utc::now().naive_utc()),
            ..Default::default()
        };

        recordings_repo::update_recording(&self.pool, self.recording_id, &update)?;
        error!(
            "Recording failed: id={}, error={}",
            self.recording_id, error_msg
        );
        Ok(())
    }
}
