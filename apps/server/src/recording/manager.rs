use anyhow::{anyhow, Result};
use chrono::Utc;
use dashmap::mapref::entry::Entry;
use dashmap::DashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::watch;
use tracing::{error, info, warn};

use crate::db::models::{NewRecording, UpdateRecording};
use crate::db::repository::recordings as recordings_repo;
use crate::recording::service::RecordingService;
use crate::state::{DbPool, MediaType, StreamManager};

pub struct ActiveRecording {
    pub recording_id: i32,
    pub topic: String,
    pub shutdown_tx: watch::Sender<()>,
}

pub struct RecordingManager {
    active_recordings: Arc<DashMap<String, ActiveRecording>>,
    streams: StreamManager,
    pool: DbPool,
    recordings_dir: PathBuf,
}

impl RecordingManager {
    pub fn new(streams: StreamManager, pool: DbPool) -> Self {
        let recordings_dir = PathBuf::from("recordings");

        // Create recordings directory if it doesn't exist
        if let Err(e) = std::fs::create_dir_all(&recordings_dir) {
            error!("Failed to create recordings directory: {}", e);
        }

        // Cleanup orphaned recordings from previous crashes
        Self::cleanup_orphaned_recordings(&pool);

        Self {
            active_recordings: Arc::new(DashMap::new()),
            streams,
            pool,
            recordings_dir,
        }
    }

    /// Mark any recordings still in "recording" status as "abandoned"
    /// This handles cases where the server crashed while recording
    fn cleanup_orphaned_recordings(pool: &DbPool) {
        match recordings_repo::mark_orphaned_as_abandoned(pool) {
            Ok(count) if count > 0 => {
                warn!(
                    "Cleaned up {} orphaned recording(s) from previous session",
                    count
                );
            }
            Ok(_) => {
                info!("No orphaned recordings found");
            }
            Err(e) => {
                error!("Failed to cleanup orphaned recordings: {}", e);
            }
        }
    }

    pub fn start_recording(&self, topic: &str, user_id: Option<i32>) -> Result<i32> {
        // Atomic check-then-insert using DashMap::entry()
        // This prevents race conditions where two threads could both pass the
        // contains_key check and try to start recordings for the same topic
        match self.active_recordings.entry(topic.to_string()) {
            Entry::Occupied(_) => {
                return Err(anyhow!(
                    "Recording already in progress for topic: {}",
                    topic
                ));
            }
            Entry::Vacant(entry) => {
                // Get stream handle
                let stream_handle = self
                    .streams
                    .get_by_topic(topic)
                    .ok_or_else(|| anyhow!("Stream not found for topic: {}", topic))?;

                let media_type = stream_handle.descriptor.media_type;
                let device_id = stream_handle.descriptor.user_id.clone();

                // Generate filename with date hierarchy
                let now = Utc::now();
                let date_path = self
                    .recordings_dir
                    .join(now.format("%Y").to_string())
                    .join(now.format("%m").to_string())
                    .join(now.format("%d").to_string());

                // Create date directory
                std::fs::create_dir_all(&date_path)?;

                // Sanitize topic for filename (replace problematic characters)
                let safe_topic = topic
                    .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
                    .chars()
                    .take(50)
                    .collect::<String>();

                let filename = format!("recording_{}_{}.mkv", safe_topic, now.format("%H%M%S"));
                let file_path = date_path.join(&filename);

                // Create database record
                let new_recording = NewRecording {
                    stream_ssrc: stream_handle.descriptor.id as i32,
                    topic,
                    device_id: &device_id,
                    media_type: match media_type {
                        MediaType::Video => "video",
                        MediaType::Audio => "audio",
                    },
                    filename: &filename,
                    file_path: file_path.to_str().unwrap(),
                    status: "recording",
                    created_by_user_id: user_id,
                };

                let recording = recordings_repo::create_recording(&self.pool, new_recording)?;
                let recording_id = recording.id;

                // Create shutdown channel
                let (shutdown_tx, shutdown_rx) = watch::channel(());

                // Start recording service in a new task with automatic cleanup
                let service = RecordingService::new(
                    recording_id,
                    stream_handle.clone(),
                    file_path,
                    self.pool.clone(),
                    media_type,
                );

                // Clone references for the spawned task
                let topic_clone = topic.to_string();
                let pool_clone = self.pool.clone();
                let active_recordings_clone = self.active_recordings.clone();

                tokio::spawn(async move {
                    let result = service.run(shutdown_rx).await;

                    // Automatic cleanup: remove from active recordings when task completes
                    active_recordings_clone.remove(&topic_clone);

                    // Update DB status on failure
                    if let Err(e) = result {
                        error!("Recording service error for id={}: {}", recording_id, e);
                        let update = UpdateRecording {
                            status: Some("failed".to_string()),
                            ended_at: Some(Utc::now().naive_utc()),
                            ..Default::default()
                        };
                        if let Err(db_err) =
                            recordings_repo::update_recording(&pool_clone, recording_id, &update)
                        {
                            error!(
                                "Failed to update recording status to failed: {}",
                                db_err
                            );
                        }
                    }
                });

                // Insert into active recordings (atomic with the entry check)
                entry.insert(ActiveRecording {
                    recording_id,
                    topic: topic.to_string(),
                    shutdown_tx,
                });

                info!("Started recording: id={}, topic={}", recording_id, topic);
                Ok(recording_id)
            }
        }
    }

    pub fn stop_recording(&self, recording_id: i32) -> Result<()> {
        // Find the active recording by ID
        let topic = self
            .active_recordings
            .iter()
            .find(|entry| entry.value().recording_id == recording_id)
            .map(|entry| entry.key().clone());

        if let Some(topic) = topic {
            self.stop_recording_by_topic(&topic)
        } else {
            Err(anyhow!("Recording not found with id: {}", recording_id))
        }
    }

    pub fn stop_recording_by_topic(&self, topic: &str) -> Result<()> {
        if let Some((_, active_recording)) = self.active_recordings.remove(topic) {
            info!(
                "Stopping recording: id={}, topic={}",
                active_recording.recording_id, topic
            );
            // Send shutdown signal
            active_recording.shutdown_tx.send(()).ok();
            Ok(())
        } else {
            Err(anyhow!("No active recording found for topic: {}", topic))
        }
    }

    pub fn is_recording(&self, topic: &str) -> bool {
        self.active_recordings.contains_key(topic)
    }

    pub fn get_active_recording_id(&self, topic: &str) -> Option<i32> {
        self.active_recordings
            .get(topic)
            .map(|entry| entry.value().recording_id)
    }

    pub fn get_all_active_recordings(&self) -> Vec<(String, i32)> {
        self.active_recordings
            .iter()
            .map(|entry| (entry.key().clone(), entry.value().recording_id))
            .collect()
    }
}
