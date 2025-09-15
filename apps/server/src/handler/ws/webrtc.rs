use anyhow::{anyhow, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{future::join_all, stream::SplitSink, FutureExt, SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot, Mutex};
use tracing::{error, info, warn};
use webrtc::{
    api::{
        media_engine::{MediaEngine, MIME_TYPE_H264, MIME_TYPE_OPUS},
        setting_engine::SettingEngine,
        APIBuilder,
    },
    ice::network_type::NetworkType,
    ice_transport::{ice_candidate::RTCIceCandidate, ice_server::RTCIceServer},
    peer_connection::{configuration::RTCConfiguration, RTCPeerConnection},
    rtp_transceiver::rtp_codec::{RTCRtpCodecCapability, RTCRtpCodecParameters, RTPCodecType},
};

use crate::handler::ws::WsMessageOut;

pub async fn create_peer_connection(
    ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
) -> Result<Arc<RTCPeerConnection>> {
    let mut m = MediaEngine::default();
    m.register_codec(
        RTCRtpCodecParameters {
            capability: RTCRtpCodecCapability {
                mime_type: MIME_TYPE_OPUS.to_owned(),
                clock_rate: 48000,
                channels: 1,
                sdp_fmtp_line: "minptime=10;useinbandfec=1".to_owned(),
                ..Default::default()
            },
            ..Default::default()
        },
        RTPCodecType::Audio,
    )?;

    m.register_codec(
        RTCRtpCodecParameters {
            capability: RTCRtpCodecCapability {
                mime_type: MIME_TYPE_H264.to_owned(),
                clock_rate: 90000,
                channels: 0,
                sdp_fmtp_line:
                    "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f"
                        .to_owned(),
                ..Default::default()
            },
            ..Default::default()
        },
        RTPCodecType::Video,
    )?;

    let mut s = SettingEngine::default();
    s.set_network_types(vec![NetworkType::Udp4]);

    let api = APIBuilder::new()
        .with_media_engine(m)
        .with_setting_engine(s)
        .build();

    let config = RTCConfiguration {
        ice_servers: vec![RTCIceServer {
            urls: vec!["stun:stun.l.google.com:19302".to_owned()],
            ..Default::default()
        }],
        ..Default::default()
    };
    let pc = Arc::new(api.new_peer_connection(config).await?);

    pc.on_ice_candidate(Box::new(move |c: Option<RTCIceCandidate>| {
        let ws_sender_clone = Arc::clone(&ws_sender);
        Box::pin(async move {
            if let Some(c) = c {
                if let Ok(candidate) = c.to_json() {
                    let msg = WsMessageOut {
                        msg_type: "candidate",
                        payload: candidate,
                    };
                    if let Ok(payload_str) = serde_json::to_string(&msg) {
                        if ws_sender_clone
                            .lock()
                            .await
                            .send(Message::Text(payload_str))
                            .await
                            .is_err()
                        {
                            info!("Failed to send ICE candidate, WebSocket closed.");
                        }
                    }
                }
            }
        })
    }));

    Ok(pc)
}
