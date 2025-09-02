use anyhow::Result;
use tokio::{net::UdpSocket, time::Instant};
use tracing::{ info, warn};
use webrtc::{
    rtp::packet::Packet,
    util::Unmarshal,
};

use crate::{ state::{ StreamManager}};


pub async fn rtp_receiver(addr: String, stream_manager: StreamManager) -> Result<()> {
    let sock = UdpSocket::bind(&addr).await?;

    let mut buf = vec![0u8; 4096];

    loop {
        let (n, from) = match sock.recv_from(&mut buf).await {
            Ok(result) => result,
            Err(e) => {
                warn!("UDP recv_from failed: {}", e);
                continue;
            }
        };

        match Packet::unmarshal(&mut &buf[..n]) {
            Ok(packet) => {
                let ssrc = packet.header.ssrc;
            
                if let Some(stream_info) = stream_manager.get(&ssrc) {
                    let mut is_online_guard = stream_info.is_online.write().await;
                    if !*is_online_guard {
                        *is_online_guard = true;
                        info!("Topic '{}' (SSRC: {}) is now ONLINE.", &stream_info.topic, ssrc);
                    }
                    drop(is_online_guard);

                    let mut last_seen_guard = stream_info.last_seen.write().await;
                    *last_seen_guard = Instant::now();
                    drop(last_seen_guard);

                    if stream_info.value().packet_tx.send(packet).is_err() {

                    }
                } else {
                    warn!("Received packet from {} with unknown SSRC: {}", from, ssrc);
                }
            }
            Err(e) => {
                warn!("Failed to unmarshal RTP packet from {}: {}", from, e);
            }
        }
    }
}