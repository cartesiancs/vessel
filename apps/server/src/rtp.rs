use anyhow::Result;
use tokio::{net::UdpSocket};
use tracing::{ warn};
use webrtc::{
    rtp::packet::Packet,
    util::Unmarshal,
};

use crate::{ state::{ StreamManager}};


pub async fn rtp_receiver(addr: String, stream_manager: StreamManager) -> Result<()> {
    let sock = UdpSocket::bind(&addr).await?;
    println!("RTP Demultiplexer listening on {}", addr);

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
      
                    if stream_info.value().packet_tx.send(packet).is_err() {
                        warn!(
                            "RTP packet for SSRC {} dropped, no active subscribers on topic '{}'.",
                            ssrc,
                            stream_info.value().topic
                        );
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