use anyhow::Result;
use async_trait::async_trait;
use tokio::{net::UdpSocket, sync::watch, time::Instant};
use tracing::{info, warn};
use webrtc::{rtp::packet::Packet, util::Unmarshal};

use crate::media::adapter::MediaAdapter;
use crate::state::{Protocol, StreamManager};

pub struct RtpPushAdapter {
    addr: String,
    streams: StreamManager,
}

impl RtpPushAdapter {
    pub fn new(addr: String, streams: StreamManager) -> Self {
        Self { addr, streams }
    }

    async fn run(&self, mut shutdown_rx: watch::Receiver<()>) -> Result<()> {
        let sock = UdpSocket::bind(&self.addr).await?;
        let mut buf = vec![0u8; 4096];

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
