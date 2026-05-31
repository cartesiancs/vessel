use anyhow::{anyhow, Result};
use dashmap::DashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::watch;
use tracing::{error, info, warn};

use crate::state::{MediaType, StreamHandle, StreamManager};
use crate::streaming::hls::HlsSession;

const REAPER_INTERVAL_SECS: u64 = 15;
const SESSION_IDLE_TIMEOUT_SECS: u64 = 60;

pub struct HlsManager {
    sessions: Arc<DashMap<String, Arc<HlsSession>>>,
    streams: StreamManager,
    base_dir: PathBuf,
}

impl HlsManager {
    pub fn new(streams: StreamManager) -> Self {
        let base_dir = PathBuf::from("hls");
        if let Err(e) = std::fs::create_dir_all(&base_dir) {
            error!("Failed to create HLS base dir: {}", e);
        } else if let Err(e) = clear_dir(&base_dir) {
            warn!("Failed to clean stale HLS sessions: {}", e);
        }

        Self {
            sessions: Arc::new(DashMap::new()),
            streams,
            base_dir,
        }
    }

    /// Returns the playlist path. Spawns a new session if one doesn't exist.
    /// On success the session's `last_access` is bumped.
    pub async fn ensure_session(&self, topic: &str) -> Result<PathBuf> {
        if let Some(existing) = self.sessions.get(topic) {
            existing.touch().await;
            return Ok(existing.playlist_path().clone());
        }

        let stream_handle = find_video_stream(&self.streams, topic)
            .ok_or_else(|| anyhow!("No video stream registered for topic '{}'", topic))?;

        let safe_topic = sanitize_topic(topic);
        let output_dir = self.base_dir.join(&safe_topic);

        let session = HlsSession::start(stream_handle, output_dir).await?;
        let session = Arc::new(session);
        let playlist_path = session.playlist_path().clone();

        // Race: another task may have started a session for the same topic
        // between the get() and here. The first inserter wins; the loser is
        // dropped and its pipeline torn down.
        if let Some(existing) = self.sessions.get(topic) {
            existing.touch().await;
            return Ok(existing.playlist_path().clone());
        }
        self.sessions.insert(topic.to_string(), session);

        Ok(playlist_path)
    }

    pub async fn touch(&self, topic: &str) {
        if let Some(session) = self.sessions.get(topic) {
            session.touch().await;
        }
    }

    pub fn has_video_stream(&self, topic: &str) -> bool {
        find_video_stream(&self.streams, topic).is_some()
    }

    pub fn segment_path(&self, topic: &str, segment: &str) -> Result<PathBuf> {
        if !is_safe_segment_name(segment) {
            return Err(anyhow!("Invalid segment name '{}'", segment));
        }
        let safe_topic = sanitize_topic(topic);
        Ok(self.base_dir.join(safe_topic).join(segment))
    }

    pub async fn run_reaper(self: Arc<Self>, mut shutdown_rx: watch::Receiver<()>) -> Result<()> {
        let mut ticker = tokio::time::interval(Duration::from_secs(REAPER_INTERVAL_SECS));
        ticker.tick().await; // skip immediate fire

        loop {
            tokio::select! {
                _ = shutdown_rx.changed() => {
                    info!("HLS reaper shutting down.");
                    break;
                }
                _ = ticker.tick() => {
                    self.reap_idle().await;
                }
            }
        }

        for entry in self.sessions.iter() {
            entry.value().shutdown();
        }
        self.sessions.clear();
        Ok(())
    }

    async fn reap_idle(&self) {
        let mut to_remove: Vec<String> = Vec::new();
        for entry in self.sessions.iter() {
            if entry.value().idle_for().await
                >= Duration::from_secs(SESSION_IDLE_TIMEOUT_SECS)
            {
                to_remove.push(entry.key().clone());
            }
        }
        for topic in to_remove {
            if let Some((_, session)) = self.sessions.remove(&topic) {
                info!("HLS reaper removing idle session for topic '{}'", topic);
                session.shutdown();
            }
        }
    }
}

fn find_video_stream(streams: &StreamManager, topic: &str) -> Option<StreamHandle> {
    streams
        .iter()
        .find(|entry| {
            entry.value().descriptor.topic == topic
                && entry.value().descriptor.media_type == MediaType::Video
        })
        .map(|entry| entry.value().clone())
}

fn sanitize_topic(topic: &str) -> String {
    topic
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

fn is_safe_segment_name(name: &str) -> bool {
    !name.is_empty()
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '.')
}

fn clear_dir(dir: &Path) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            std::fs::remove_dir_all(&path)?;
        } else {
            std::fs::remove_file(&path)?;
        }
    }
    Ok(())
}
