use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use futures_util::{stream::SplitSink, SinkExt};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::{info, warn};
use interceptor::registry::Registry;
use webrtc::{
    api::{
        interceptor_registry::register_default_interceptors,
        media_engine::{MediaEngine, MIME_TYPE_H264, MIME_TYPE_OPUS},
        APIBuilder,
    },
    ice_transport::{
        ice_candidate::RTCIceCandidate,
        ice_connection_state::RTCIceConnectionState,
        ice_gatherer_state::RTCIceGathererState,
    },
    peer_connection::{
        configuration::RTCConfiguration,
        peer_connection_state::RTCPeerConnectionState,
        RTCPeerConnection,
    },
    rtp_transceiver::rtp_codec::{RTCRtpCodecCapability, RTCRtpCodecParameters, RTPCodecType},
};

use crate::handler::ws::WsMessageOut;

pub async fn create_peer_connection(
    ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
) -> Result<Arc<RTCPeerConnection>> {
    info!(">>> create_peer_connection v2 (no SettingEngine restriction) <<<");
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

    let mut registry = Registry::new();
    registry = register_default_interceptors(registry, &mut m)?;

    let api = APIBuilder::new()
        .with_media_engine(m)
        .with_interceptor_registry(registry)
        .build();

    // No ICE servers: viewers reach the server on the LAN through host candidates, and Vessel
    // makes no calls to external STUN/TURN services.
    let config = RTCConfiguration::default();
    let pc = Arc::new(api.new_peer_connection(config).await?);

    pc.on_ice_connection_state_change(Box::new(move |state: RTCIceConnectionState| {
        Box::pin(async move {
            info!("ICE connection state changed: {:?}", state);
        })
    }));

    pc.on_peer_connection_state_change(Box::new(move |state: RTCPeerConnectionState| {
        Box::pin(async move {
            info!("Peer connection state changed: {:?}", state);
        })
    }));

    pc.on_ice_candidate(Box::new(move |c: Option<RTCIceCandidate>| {
        let ws_sender_clone = Arc::clone(&ws_sender);
        Box::pin(async move {
            if let Some(c) = c {
                let cand_str = c.to_string();
                let cand_type = if cand_str.contains("relay") {
                    "RELAY"
                } else if cand_str.contains("srflx") {
                    "SRFLX"
                } else {
                    "HOST"
                };
                info!("Server ICE candidate [{}]: {}", cand_type, cand_str);
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
                            warn!("Failed to send ICE candidate, WebSocket closed.");
                        }
                    }
                }
            } else {
                info!("ICE candidate gathering complete (null candidate).");
            }
        })
    }));

    pc.on_ice_gathering_state_change(Box::new(move |state: RTCIceGathererState| {
        Box::pin(async move {
            info!("ICE gathering state changed: {:?}", state);
        })
    }));

    Ok(pc)
}
