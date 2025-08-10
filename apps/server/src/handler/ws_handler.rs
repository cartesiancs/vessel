use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures_util::{stream::SplitSink, SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{string, sync::Arc};
use tokio::sync::{mpsc, oneshot, Mutex};
use tracing::{error, info, warn};
use webrtc::{
    api::{
        media_engine::{MediaEngine, MIME_TYPE_OPUS},
        APIBuilder,
    },
    ice_transport::{
        ice_candidate::{RTCIceCandidate, RTCIceCandidateInit},
        ice_server::RTCIceServer,
    },
    peer_connection::{
        configuration::RTCConfiguration, peer_connection_state::RTCPeerConnectionState,
        sdp::session_description::RTCSessionDescription,
    },
    rtp_transceiver::rtp_codec::{RTCRtpCodecCapability, RTCRtpCodecParameters, RTPCodecType},
    track::track_local::{track_local_static_rtp::TrackLocalStaticRTP, TrackLocal, TrackLocalWriter},
};

use crate::{handler::auth::JwtAuth, AppState};

#[derive(Serialize)]
struct WsMessageOut<'a, T: Serialize> {
    #[serde(rename = "type")]
    msg_type: &'a str,
    payload: T,
}

enum ActorCommand {
    SetRemoteOffer {
        offer: RTCSessionDescription,
        responder: oneshot::Sender<Result<RTCSessionDescription>>,
    },
    AddIceCandidate {
        candidate: RTCIceCandidateInit,
    },
    HealthCheck {
        payload: serde_json::Value,
    },
}

struct WebRtcActor {
    pc: Arc<webrtc::peer_connection::RTCPeerConnection>,
    ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    receiver: mpsc::Receiver<ActorCommand>,
}

impl WebRtcActor {
    async fn run(mut self) {
        info!("WebRTC Actor started.");
        while let Some(cmd) = self.receiver.recv().await {
            match cmd {
                ActorCommand::SetRemoteOffer { offer, responder } => {
                    let pc_clone = Arc::clone(&self.pc);
                    let res = Self::handle_offer(pc_clone, offer).await;
                    if responder.send(res).is_err() {
                        error!("Failed to send answer back to handler.");
                    }
                }
                ActorCommand::AddIceCandidate { candidate } => {
                    if let Err(e) = self.pc.add_ice_candidate(candidate).await {
                        error!("Actor failed to add ICE candidate: {}", e);
                    }
                }
                ActorCommand::HealthCheck { payload } => {
                    #[derive(Serialize)]
                    struct HealthStatus<'a> {
                        status: &'a str,
                        echo: serde_json::Value,
                    }

                    let response_payload = HealthStatus {
                        status: "ok",
                        echo: payload,
                    };
                    
                    let ws_message = WsMessageOut {
                        msg_type: "health_check_response",
                        payload: response_payload,
                    };

                    let payload_str = serde_json::to_string(&ws_message).unwrap();

                    let mut sender = self.ws_sender.lock().await;
                    if let Err(e) = sender.send(Message::Text(payload_str)).await {
                        error!("Failed to send health check response: {}", e);
                    } else {
                        info!("Health check response sent.");
                    }
                }
            }
        }
        info!("WebRTC Actor finished.");
    }

    async fn handle_offer(
        pc: Arc<webrtc::peer_connection::RTCPeerConnection>,
        offer: RTCSessionDescription,
    ) -> Result<RTCSessionDescription> {
        pc.set_remote_description(offer).await?;
        let answer = pc.create_answer(None).await?;
        pc.set_local_description(answer).await?;
        let local_desc =
            pc.local_description()
                .await
                .ok_or_else(|| anyhow::Error::msg("Failed to get local description"))?;
        Ok(local_desc)
    }
}

pub async fn ws_handler(
    JwtAuth(claims): JwtAuth, 
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(move |socket| {
        info!("'{}' authenticated and connected.", claims.sub); 
        handle_socket(socket, state)
    })
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    info!("WebSocket connection established. Spawning dedicated actor...");
    let (ws_sender, mut ws_receiver) = socket.split();
    let ws_sender = Arc::new(Mutex::new(ws_sender));

    let mut mqtt_rx = state.mqtt_tx.subscribe();
    let ws_sender_for_mqtt = Arc::clone(&ws_sender);

    tokio::spawn(async move {
        info!("MQTT message forwarding task started for a new WebSocket client.");
        while let Ok(msg) = mqtt_rx.recv().await {
            let ws_message = WsMessageOut {
                msg_type: "mqtt_message",
                payload: &msg,
            };

            if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                let mut sender = ws_sender_for_mqtt.lock().await;
                if sender.send(Message::Text(payload_str)).await.is_err() {
                    break; 
                }
            } else {
                error!("Failed to serialize MQTT message for WebSocket.");
            }
        }
        info!("MQTT message forwarding task stopped.");
    });

    let (cmd_tx, cmd_rx) = mpsc::channel(10);
    let packet_tx_clone = state.packet_tx.clone();
    let ws_sender_for_thread = Arc::clone(&ws_sender);

    std::thread::spawn(move || {
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        rt.block_on(async move {
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
                    payload_type: 111,
                    ..Default::default()
                },
                RTPCodecType::Audio,
            )
            .unwrap();

            let api = APIBuilder::new().with_media_engine(m).build();
            let config = RTCConfiguration {
                ice_servers: vec![RTCIceServer {
                    urls: vec!["stun:stun.l.google.com:19302".to_owned()],
                    ..Default::default()
                }],
                ..Default::default()
            };
            let pc = Arc::new(api.new_peer_connection(config).await.unwrap());

            let audio_track = Arc::new(TrackLocalStaticRTP::new(
                RTCRtpCodecCapability {
                    mime_type: MIME_TYPE_OPUS.to_owned(),
                    clock_rate: 48000,
                    channels: 1,
                    sdp_fmtp_line: "minptime=10;useinbandfec=1".to_owned(),
                    ..Default::default()
                },
                "audio".to_owned(),
                "webrtc-stream".to_owned(),
            ));

            let rtp_sender = pc
                .add_track(Arc::clone(&audio_track) as Arc<dyn TrackLocal + Send + Sync>)
                .await
                .unwrap();

            tokio::spawn(async move {
                let mut rtcp_buf = vec![0u8; 1500];
                while rtp_sender.read(&mut rtcp_buf).await.is_ok() {}
            });

            let ice_ws_sender = Arc::clone(&ws_sender_for_thread);
            pc.on_ice_candidate(Box::new(move |c: Option<RTCIceCandidate>| {
                let ws_sender = Arc::clone(&ice_ws_sender);
                Box::pin(async move {
                    if let Some(c) = c {
                        if let Ok(candidate) = c.to_json() {
                            let msg = WsMessageOut {
                                msg_type: "candidate",
                                payload: candidate,
                            };
                            if let Ok(payload_str) = serde_json::to_string(&msg) {
                                let mut sender = ws_sender.lock().await;
                                if let Err(e) = sender.send(Message::Text(payload_str)).await {
                                    error!("Failed to send ICE candidate: {}", e);
                                }
                            }
                        }
                    }
                })
            }));

            let packet_tx = packet_tx_clone;
            pc.on_peer_connection_state_change(Box::new(move |s: RTCPeerConnectionState| {
                info!("Peer Connection State has changed: {}", s);
                let audio_track_clone = Arc::clone(&audio_track);
                if s == RTCPeerConnectionState::Connected {
                    let mut rx = packet_tx.subscribe();
                    tokio::spawn(async move {
                        info!("RTP packet forwarding started.");
                        while let Ok(pkt) = rx.recv().await {
                            if audio_track_clone.write_rtp(&pkt).await.is_err() {
                                error!("RTP packet write failed, stopping forwarding.");
                                break;
                            }
                        }
                        info!("RTP packet forwarding stopped.");
                    });
                }
                Box::pin(async {})
            }));

            let actor = WebRtcActor {
                pc,
                ws_sender: ws_sender_for_thread,
                receiver: cmd_rx,
            };
            actor.run().await;
        });
    });

    #[derive(Deserialize)]
    struct WsMessage {
        #[serde(rename = "type")]
        msg_type: String,
        payload: serde_json::Value,
    }

    while let Some(Ok(msg)) = ws_receiver.next().await {
        if let Message::Text(text) = msg {
            let ws_msg: WsMessage = match serde_json::from_str(&text) {
                Ok(json) => json,
                Err(e) => {
                    error!("Failed to parse incoming message: {}", e);
                    continue;
                }
            };

            match ws_msg.msg_type.as_str() {
                "offer" => {
                    if let Ok(offer) = serde_json::from_value(ws_msg.payload) {
                        let (responder_tx, responder_rx) = oneshot::channel();
                        let cmd = ActorCommand::SetRemoteOffer {
                            offer,
                            responder: responder_tx,
                        };
                        if cmd_tx.send(cmd).await.is_err() {
                            break;
                        }

                        if let Ok(Ok(answer)) = responder_rx.await {
                            let ws_answer = WsMessageOut {
                                msg_type: "answer",
                                payload: &answer,
                            };
                            let payload_str = serde_json::to_string(&ws_answer).unwrap();
                            let mut sender = ws_sender.lock().await;
                            if sender.send(Message::Text(payload_str)).await.is_err() {
                                break;
                            }
                        }
                    }
                }
                "candidate" => {
                    println!("Received ICE candidate: {:?}", ws_msg.payload);

                    if let Ok(candidate) = serde_json::from_value(ws_msg.payload) {
                        let cmd = ActorCommand::AddIceCandidate { candidate };
                        if cmd_tx.send(cmd).await.is_err() {
                            break;
                        }
                    }
                }
                "health_check" => {
                    let cmd = ActorCommand::HealthCheck {
                        payload: ws_msg.payload,
                    };
                    if cmd_tx.send(cmd).await.is_err() {
                        break;
                    }
                }
                _ => {
                    error!("Unknown message type: {}", ws_msg.msg_type);
                }
            }
        }
    }

    info!("WebSocket connection closed. Handler finished.");
}