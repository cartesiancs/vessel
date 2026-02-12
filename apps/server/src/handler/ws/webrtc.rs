use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use chrono::Utc;
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
        ice_server::RTCIceServer,
    },
    peer_connection::{
        configuration::RTCConfiguration,
        peer_connection_state::RTCPeerConnectionState,
        RTCPeerConnection,
    },
    rtp_transceiver::rtp_codec::{RTCRtpCodecCapability, RTCRtpCodecParameters, RTPCodecType},
};

use crate::db;
use crate::handler::ws::WsMessageOut;
use crate::state::DbPool;

/// Filter TURN URLs for webrtc-rs compatibility.
/// webrtc-rs does not support `turns:` (TURN over TLS), so drop those.
/// Keep `turn:` with both UDP and TCP transports.
fn filter_ice_url(url: &str) -> Option<String> {
    if url.starts_with("turns:") {
        warn!("Dropping unsupported turns: URL (webrtc-rs has no TLS TURN): {}", url);
        return None;
    }
    if url.contains("transport=tcp") {
        warn!("Dropping TCP TURN URL (webrtc-rs only supports UDP TURN): {}", url);
        return None;
    }
    Some(url.to_owned())
}

fn build_ice_servers(pool: &DbPool) -> Vec<RTCIceServer> {
    let default_stun = RTCIceServer {
        urls: vec!["stun:stun.l.google.com:19302".to_owned()],
        ..Default::default()
    };

    let configs = match db::repository::get_all_system_configs(pool) {
        Ok(c) => c,
        Err(e) => {
            warn!("Failed to read system configs for TURN: {}", e);
            return vec![default_stun];
        }
    };

    let turn_entry = match configs
        .iter()
        .find(|c| c.key == "turn_server_config" && c.enabled == 1)
    {
        Some(entry) => entry,
        None => return vec![default_stun],
    };

    let parsed: serde_json::Value = match serde_json::from_str(&turn_entry.value) {
        Ok(v) => v,
        Err(e) => {
            warn!("Failed to parse turn_server_config JSON: {}", e);
            return vec![default_stun];
        }
    };

    if let Some(expires_at) = parsed.get("expiresAt").and_then(|v| v.as_str()) {
        if let Ok(exp) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            if exp < Utc::now() {
                warn!("TURN credentials expired at {}", expires_at);
                return vec![default_stun];
            }
        }
    }

    let ice_servers_arr = match parsed.get("iceServers").and_then(|v| v.as_array()) {
        Some(arr) => arr,
        None => return vec![default_stun],
    };

    let mut servers = vec![default_stun];

    for entry in ice_servers_arr {
        let raw_urls: Vec<String> = if let Some(url_str) = entry.get("urls").and_then(|v| v.as_str()) {
            vec![url_str.to_owned()]
        } else if let Some(url_arr) = entry.get("urls").and_then(|v| v.as_array()) {
            url_arr
                .iter()
                .filter_map(|u| u.as_str().map(String::from))
                .collect()
        } else {
            continue;
        };

        let urls: Vec<String> = raw_urls
            .into_iter()
            .filter_map(|u| filter_ice_url(&u))
            .collect();

        if urls.is_empty() {
            continue;
        }

        let username = entry
            .get("username")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_owned();
        let credential = entry
            .get("credential")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_owned();

        servers.push(RTCIceServer {
            urls,
            username,
            credential,
            ..Default::default()
        });
    }

    for s in &servers {
        info!(
            "  ICE server: urls={:?}, has_credentials={}",
            s.urls,
            !s.username.is_empty()
        );
    }
    info!("Built {} ICE server(s) total", servers.len());
    servers
}

pub async fn create_peer_connection(
    ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    pool: &DbPool,
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

    let config = RTCConfiguration {
        ice_servers: build_ice_servers(pool),
        ..Default::default()
    };
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
