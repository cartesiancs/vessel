use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::{net::UdpSocket, sync::watch, time::Instant};
use tracing::{info, warn};
use webrtc::{rtp::packet::Packet, util::Unmarshal};

use crate::media::adapter::MediaAdapter;
use crate::media::StreamActivator;
use crate::state::{Protocol, StreamManager};

const MAX_DATAGRAM_BYTES: usize = 65535;
/// How long to wait before asking the database again about the same unknown SSRC.
const UNKNOWN_SSRC_RETRY: Duration = Duration::from_secs(5);
/// Caps database lookups so a flood of random SSRCs cannot overload the pool.
const MAX_LOOKUPS_PER_WINDOW: u32 = 16;
const LOOKUP_WINDOW: Duration = Duration::from_secs(1);
const MAX_TRACKED_UNKNOWN_SSRCS: usize = 1024;

pub struct RtpPushAdapter {
    addr: String,
    streams: StreamManager,
    activator: Arc<StreamActivator>,
}

/// Rate limiter for rehydration lookups. Owned by the single receive loop, so no locking.
struct UnknownSsrcLimiter {
    last_lookup: HashMap<u32, Instant>,
    window_start: Instant,
    lookups_in_window: u32,
}

impl UnknownSsrcLimiter {
    fn new() -> Self {
        Self {
            last_lookup: HashMap::new(),
            window_start: Instant::now(),
            lookups_in_window: 0,
        }
    }

    fn allow(&mut self, ssrc: u32, now: Instant) -> bool {
        if now.duration_since(self.window_start) >= LOOKUP_WINDOW {
            self.window_start = now;
            self.lookups_in_window = 0;
        }
        if self.lookups_in_window >= MAX_LOOKUPS_PER_WINDOW {
            return false;
        }
        if let Some(last) = self.last_lookup.get(&ssrc) {
            if now.duration_since(*last) < UNKNOWN_SSRC_RETRY {
                return false;
            }
        }
        if self.last_lookup.len() >= MAX_TRACKED_UNKNOWN_SSRCS {
            self.last_lookup
                .retain(|_, last| now.duration_since(*last) < UNKNOWN_SSRC_RETRY);
            if self.last_lookup.len() >= MAX_TRACKED_UNKNOWN_SSRCS {
                return false;
            }
        }
        self.last_lookup.insert(ssrc, now);
        self.lookups_in_window += 1;
        true
    }
}

impl RtpPushAdapter {
    pub fn new(addr: String, streams: StreamManager, activator: Arc<StreamActivator>) -> Self {
        Self {
            addr,
            streams,
            activator,
        }
    }

    async fn run(&self, mut shutdown_rx: watch::Receiver<()>) -> Result<()> {
        let sock = UdpSocket::bind(&self.addr).await?;
        let mut buf = vec![0u8; MAX_DATAGRAM_BYTES];
        let mut limiter = UnknownSsrcLimiter::new();

        loop {
            tokio::select! {
                _ = shutdown_rx.changed() => {
                    info!("RTP Push Adapter received shutdown signal.");
                    break;
                }
                result = sock.recv_from(&mut buf) => {
                    let (n, from) = match result {
                        Ok(res) => res,
                        Err(e) => {
                            warn!("UDP recv_from failed: {}", e);
                            continue;
                        }
                    };

                    match Packet::unmarshal(&mut &buf[..n]) {
                        Ok(packet) => {
                            let ssrc = packet.header.ssrc;

                            if let Some(handle) = self.streams.get_by_ssrc(ssrc) {
                                let mut is_online_guard = handle.is_online.write().unwrap();
                                let was_offline = !*is_online_guard;
                                *is_online_guard = true;
                                drop(is_online_guard);

                                let mut last_seen_guard = handle.last_seen.write().unwrap();
                                *last_seen_guard = Instant::now();
                                drop(last_seen_guard);

                                if was_offline {
                                    info!(
                                        "Topic '{}' (SSRC: {}) is now ONLINE.",
                                        handle.descriptor.topic, ssrc
                                    );
                                }

                                let _ = handle.packet_tx.send(packet);
                            } else if limiter.allow(ssrc, Instant::now()) {
                                tokio::spawn(self.activator.clone().rehydrate(ssrc));
                            }
                        }
                        Err(e) => {
                            warn!("Failed to unmarshal RTP packet from {}: {}", from, e);
                        }
                    }
                }
            }
        }

        Ok(())
    }
}

#[async_trait]
impl MediaAdapter for RtpPushAdapter {
    fn protocol(&self) -> Protocol {
        Protocol::Udp
    }

    async fn start(&self, shutdown: watch::Receiver<()>) -> Result<()> {
        self.run(shutdown).await
    }
}

