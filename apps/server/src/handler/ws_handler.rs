use anyhow::{anyhow, Result};
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use futures_util::{stream::SplitSink, SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use sysinfo::System;
use tokio::sync::{mpsc, oneshot, Mutex};
use tracing::{error, info, warn};
use webrtc::{
    api::{
        media_engine::{MediaEngine, MIME_TYPE_H264, MIME_TYPE_OPUS},
        setting_engine::SettingEngine,
        APIBuilder,
    }, ice::network_type::NetworkType, ice_transport::{
        ice_candidate::{RTCIceCandidate, RTCIceCandidateInit},
        ice_server::RTCIceServer,
    }, peer_connection::{
        configuration::RTCConfiguration, sdp::session_description::RTCSessionDescription,
        RTCPeerConnection,
    }, rtp_transceiver::rtp_codec::{RTCRtpCodecCapability, RTCRtpCodecParameters, RTPCodecType}, track::track_local::{
        track_local_static_rtp::TrackLocalStaticRTP, track_local_static_sample::TrackLocalStaticSample, TrackLocal, TrackLocalWriter
    }
};

use crate::{
    db,
    flow::engine::FlowEngine,
    handler::auth::JwtAuth,
    state::{AppState, FrameData, MediaType},
};

#[derive(Serialize)]
struct WsMessageOut<'a, T: Serialize> {
    #[serde(rename = "type")]
    msg_type: &'a str,
    payload: T,
}

#[derive(Deserialize)]
struct WsMessageIn {
    #[serde(rename = "type")]
    msg_type: String,
    payload: serde_json::Value,
}

#[derive(Serialize)]
struct ServerStats {
    cpu_usage: f32,
    memory_usage: f32,
}

#[derive(Deserialize)]
struct SubscribeStreamPayload {
    topic: String,
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
    ComputeFlow {
        payload: serde_json::Value,
    },
    SubscribeToTopic {
        topic: String,
    },
    Ping {
        payload: serde_json::Value,
    },
    GetServer {
        responder: oneshot::Sender<Result<ServerStats>>,
    },
}

struct WebRtcActor {
    pc: Arc<RTCPeerConnection>,
    ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    receiver: mpsc::Receiver<ActorCommand>,
    state: Arc<AppState>,
    audio_track: Arc<TrackLocalStaticRTP>,
    video_track: Arc<TrackLocalStaticSample>, 
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
                    self.handle_health_check(payload).await;
                }
                ActorCommand::ComputeFlow { payload } => {
                    self.handle_compute_flow(payload).await;
                }
                ActorCommand::SubscribeToTopic { topic } => {
                    self.handle_subscribe(topic).await;
                }
                ActorCommand::Ping { payload } => {
                    self.handle_ping(payload).await;
                }
                ActorCommand::GetServer { responder } => {
                    let res = self.handle_get_server().await;
                    if responder.send(res).is_err() {
                        error!("Failed to send server stats back to handler.");
                    }
                }
            }
        }
        info!("WebRTC Actor finished.");
    }

    async fn handle_get_server(&self) -> Result<ServerStats> {
        tokio::task::spawn_blocking(|| {
            let mut sys = System::new();
            sys.refresh_cpu_all();
            let cpu_usage =
                sys.cpus().iter().map(|cpu| cpu.cpu_usage()).sum::<f32>() / sys.cpus().len() as f32;
            sys.refresh_memory();
            let memory_usage = (sys.used_memory() as f32 / sys.total_memory() as f32) * 100.0;
            Ok(ServerStats {
                cpu_usage,
                memory_usage,
            })
        })
        .await?
    }

    async fn handle_offer(
        pc: Arc<RTCPeerConnection>,
        offer: RTCSessionDescription,
    ) -> Result<RTCSessionDescription> {
        pc.set_remote_description(offer).await?;
        let answer = pc.create_answer(None).await?;
        pc.set_local_description(answer).await?;
        pc.local_description()
            .await
            .ok_or_else(|| anyhow!("Failed to get local description"))
    }

    async fn handle_health_check(&self, payload: serde_json::Value) {
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
        if let Ok(payload_str) = serde_json::to_string(&ws_message) {
            if self
                .ws_sender
                .lock()
                .await
                .send(Message::Text(payload_str))
                .await
                .is_err()
            {
                error!("Failed to send health check response.");
            }
        }
    }

    async fn handle_ping(&self, payload: serde_json::Value) {
        let ws_message = WsMessageOut {
            msg_type: "pong",
            payload,
        };
        if let Ok(payload_str) = serde_json::to_string(&ws_message) {
            if self
                .ws_sender
                .lock()
                .await
                .send(Message::Text(payload_str))
                .await
                .is_err()
            {
                error!("Failed to send pong response.");
            }
        }
    }

    async fn handle_compute_flow(&self, payload: serde_json::Value) {
        if let Some(value) = payload.get("flow_id") {
            if !value.is_number() {
                error!("Invalid flow_id in payload: {:?}", payload);
                return;
            }

            let age_i64: i64 = value.as_i64().unwrap_or_default();

            let versions =
                db::repository::get_versions_for_flow(&self.state.pool, age_i64 as i32)
                    .expect("msg");
            if versions.is_empty() {
                error!("No versions found for flow_id: {}", age_i64);
                return;
            }

            let latest_version = versions[0].clone();
            let json_data = latest_version.graph_json;
            let graph = serde_json::from_str(&json_data).expect("Failed to parse graph JSON");
            let engine = FlowEngine::new(graph).expect("Failed to create FlowEngine");

            engine.run(self.ws_sender.clone()).await;
        } else {
            error!("Missing flow_id in payload: {:?}", payload);
        }
    }

    async fn handle_subscribe(&self, topic: String) {
        if let Some((ssrc, info)) = self
            .state
            .streams
            .iter()
            .find(|entry| entry.value().topic == topic)
            .map(|entry| (*entry.key(), entry.value().clone()))
        {
            info!(
                "Actor subscribing to pre-existing RTP stream '{}' with SSRC {}",
                topic, ssrc
            );
            let mut rx = info.packet_tx.subscribe();

            if info.media_type == MediaType::Audio {
                let audio_track_clone = Arc::clone(&self.audio_track);
                tokio::spawn(async move {
                    info!("Audio RTP packet forwarding started for SSRC: {}", ssrc);
                    while let Ok(pkt) = rx.recv().await {
                        // TrackLocalStaticRTP에는 write_rtp 사용
                        if audio_track_clone.write_rtp(&pkt).await.is_err() {
                            warn!("Audio RTP packet write failed for SSRC: {}", ssrc);
                            break;
                        }
                    }
                    info!("Audio RTP packet forwarding stopped for SSRC: {}", ssrc);
                });
            }
            return;
        }

        // 2. GStreamer를 통한 원시 H.264 프레임 (비디오) 처리
        if self
            .state
            .topic_map
            .read()
            .await
            .iter()
            .any(|m| m.topic == topic && m.protocol == crate::state::Protocol::RTSP)
        {
            info!("Actor subscribing to raw H264 stream topic '{}'", topic);
            let mut rx = self.state.rtsp_frame_tx.subscribe();
            let video_track_clone = Arc::clone(&self.video_track);
            let topic_clone = topic.clone();

            tokio::spawn(async move {
                info!(
                    "Raw H.264 frame forwarding started for topic: {}",
                    topic_clone
                );
                while let Ok(frame) = rx.recv().await {
                    if frame.topic == topic_clone {
                        let sample = webrtc::media::Sample {
                            data: frame.buffer.clone(),
                            duration: std::time::Duration::from_millis(33), // 30fps 가정
                            ..Default::default()
                        };
                        // TrackLocalStaticSample에는 write_sample 사용
                        if let Err(e) = video_track_clone.write_sample(&sample).await {
                            if webrtc::error::Error::ErrClosedPipe.eq(&e) {
                                info!(
                                    "Video track closed, stopping forwarding for topic: {}",
                                    topic_clone
                                );
                            } else {
                                warn!(
                                    "Failed to write H.264 sample for topic {}: {}",
                                    topic_clone, e
                                );
                            }
                            break;
                        }
                    }
                }
                info!(
                    "Raw H.264 frame forwarding stopped for topic: {}",
                    topic_clone
                );
            });
        } else {
            warn!("Actor could not find any stream to subscribe: {}", topic);
        }
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
    let (ws_sender, mut ws_receiver) = socket.split();
    let ws_sender = Arc::new(Mutex::new(ws_sender));

    let mut mqtt_rx = state.mqtt_tx.subscribe();
    let ws_sender_for_mqtt = Arc::clone(&ws_sender);
    tokio::spawn(async move {
        while let Ok(msg) = mqtt_rx.recv().await {
            let ws_message = WsMessageOut {
                msg_type: "mqtt_message",
                payload: &msg,
            };
            if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                if ws_sender_for_mqtt
                    .lock()
                    .await
                    .send(Message::Text(payload_str))
                    .await
                    .is_err()
                {
                    break;
                }
            }
        }
    });

    let (cmd_tx, cmd_rx) = mpsc::channel(10);

    tokio::spawn({
        let state = Arc::clone(&state);
        let ws_sender = Arc::clone(&ws_sender);

        async move {
            let mut m = MediaEngine::default();
            m.register_codec(
                RTCRtpCodecParameters {
                    capability: RTCRtpCodecCapability {
                        mime_type: MIME_TYPE_OPUS.to_owned(),
                        clock_rate: 48000,
                        channels: 2,
                        sdp_fmtp_line: "minptime=10;useinbandfec=1".to_owned(),
                        ..Default::default()
                    },
                    payload_type: 111,
                    ..Default::default()
                },
                RTPCodecType::Audio,
            )
            .unwrap();

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
                    payload_type: 102,
                    ..Default::default()
                },
                RTPCodecType::Video,
            )
            .unwrap();

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
            let pc = Arc::new(api.new_peer_connection(config).await.unwrap());

            let audio_track = Arc::new(TrackLocalStaticRTP::new(
                RTCRtpCodecCapability {
                    mime_type: MIME_TYPE_OPUS.to_owned(),
                    ..Default::default()
                },
                "audio".to_owned(),
                "webrtc-stream-audio".to_owned(),
            ));
            let rtp_sender_audio = pc
                .add_track(Arc::clone(&audio_track) as Arc<dyn TrackLocal + Send + Sync>)
                .await
                .unwrap();
            tokio::spawn(async move {
                let mut rtcp_buf = vec![0u8; 1500];
                while rtp_sender_audio.read(&mut rtcp_buf).await.is_ok() {}
            });

            let video_track = Arc::new(TrackLocalStaticSample::new( // 이 부분만 변경
                RTCRtpCodecCapability {
                    mime_type: MIME_TYPE_H264.to_owned(),
                    ..Default::default()
                },
                "video".to_owned(),
                "webrtc-stream-video".to_owned(),
            ));
            let rtp_sender_video = pc
                .add_track(Arc::clone(&video_track) as Arc<dyn TrackLocal + Send + Sync>)
                .await
                .unwrap();
            tokio::spawn(async move {
                let mut rtcp_buf = vec![0u8; 1500];
                while rtp_sender_video.read(&mut rtcp_buf).await.is_ok() {}
            });

            let ws_sender_for_ice = Arc::clone(&ws_sender);
            pc.on_ice_candidate(Box::new(move |c: Option<RTCIceCandidate>| {
                let ws_sender = Arc::clone(&ws_sender_for_ice);
                Box::pin(async move {
                    if let Some(c) = c {
                        if let Ok(candidate) = c.to_json() {
                            let msg = WsMessageOut {
                                msg_type: "candidate",
                                payload: candidate,
                            };
                            if let Ok(payload_str) = serde_json::to_string(&msg) {
                                if ws_sender
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

            let actor = WebRtcActor {
                pc,
                ws_sender,
                receiver: cmd_rx,
                state: Arc::clone(&state),
                audio_track,
                video_track,
            };
            actor.run().await;
        }
    });

    while let Some(Ok(msg)) = ws_receiver.next().await {
        if let Message::Text(text) = msg {
            let ws_msg: WsMessageIn = match serde_json::from_str(&text) {
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
                            if let Ok(payload_str) = serde_json::to_string(&ws_answer) {
                                if ws_sender
                                    .lock()
                                    .await
                                    .send(Message::Text(payload_str))
                                    .await
                                    .is_err()
                                {
                                    break;
                                }
                            }
                        }
                    }
                }
                "candidate" => {
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
                "compute_flow" => {
                    let cmd = ActorCommand::ComputeFlow {
                        payload: ws_msg.payload,
                    };
                    if cmd_tx.send(cmd).await.is_err() {
                        break;
                    }
                }
                "ping" => {
                    let cmd = ActorCommand::Ping {
                        payload: ws_msg.payload,
                    };
                    if cmd_tx.send(cmd).await.is_err() {
                        break;
                    }
                }
                "subscribe_stream" => {
                    if let Ok(payload) =
                        serde_json::from_value::<SubscribeStreamPayload>(ws_msg.payload)
                    {
                        info!("Received subscribe request for topic: {}", payload.topic);
                        let cmd = ActorCommand::SubscribeToTopic {
                            topic: payload.topic,
                        };
                        if cmd_tx.send(cmd).await.is_err() {
                            break;
                        }
                    }
                }
                "get_server" => {
                    let (responder_tx, responder_rx) = oneshot::channel();
                    let cmd = ActorCommand::GetServer {
                        responder: responder_tx,
                    };
                    if cmd_tx.send(cmd).await.is_err() {
                        break;
                    }
                    if let Ok(Ok(stats)) = responder_rx.await {
                        let ws_response = WsMessageOut {
                            msg_type: "get_server",
                            payload: &stats,
                        };
                        if let Ok(payload_str) = serde_json::to_string(&ws_response) {
                            if ws_sender
                                .lock()
                                .await
                                .send(Message::Text(payload_str))
                                .await
                                .is_err()
                            {
                                break;
                            }
                        }
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