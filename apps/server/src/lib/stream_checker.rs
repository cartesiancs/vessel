use anyhow::Result;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::watch;
use tracing::info;

use crate::state::AppState;

const STREAM_TIMEOUT: Duration = Duration::from_secs(10);

pub async fn stream_status_checker(
    app_state: Arc<AppState>,
    mut shutdown_rx: watch::Receiver<()>,
) -> Result<()> {
    let mut interval = tokio::time::interval(Duration::from_secs(5));

    loop {
        tokio::select! {
            biased;

            _ = shutdown_rx.changed() => {
                info!("Stream status checker: Shutdown signal received, exiting.");
                break;
            }

            _ = interval.tick() => {
                let mut offline_ssrcs = Vec::new();

                for entry in app_state.streams.iter() {
                    let ssrc = *entry.key();
                    let stream_info = entry.value();

                    let is_online = *stream_info.is_online.read().await;
                    let last_seen = *stream_info.last_seen.read().await;

                    if is_online && last_seen.elapsed() > STREAM_TIMEOUT {
                        let mut is_online_guard = stream_info.is_online.write().await;
                        if *is_online_guard {
                            *is_online_guard = false;
                            info!(
                                "Topic '{}' (SSRC: {}) is now OFFLINE due to timeout.",
                                &stream_info.topic, ssrc
                            );
                            offline_ssrcs.push(ssrc);
                        }
                    }
                }

                for ssrc in offline_ssrcs {
                    if let Some((_, removed_stream)) = app_state.streams.remove(&ssrc) {
                        info!(
                            "Removed timed-out stream for topic '{}' (SSRC: {})",
                            removed_stream.topic, ssrc
                        );
                    }
                }
            }
        }
    }

    Ok(())
}

