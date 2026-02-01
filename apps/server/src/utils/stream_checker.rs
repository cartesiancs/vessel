use anyhow::Result;
use std::sync::Arc;
use std::time::Duration;
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

                    let _is_online = *stream_info.is_online.read().unwrap();
                    let last_seen = *stream_info.last_seen.read().unwrap();

                    if last_seen.elapsed() > STREAM_TIMEOUT {
                        let mut is_online_guard = stream_info.is_online.write().unwrap();
                        *is_online_guard = false;
                        info!(
                            "Topic '{}' (SSRC: {}) is now OFFLINE due to timeout.",
                            &stream_info.descriptor.topic, ssrc
                        );
                        offline_ssrcs.push(ssrc);
                    }
                }

                for ssrc in offline_ssrcs {
                    if let Some((_, removed_stream)) = app_state.streams.remove(&ssrc) {
                        // db::repository::streams::delete_stream(&app_state.pool, ssrc.try_into().unwrap());
                        info!(
                            "Removed timed-out stream for topic '{}' (SSRC: {})",
                            removed_stream.descriptor.topic, ssrc
                        );
                    }
                }
            }
        }
    }

    Ok(())
}
