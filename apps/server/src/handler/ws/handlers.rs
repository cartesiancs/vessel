use anyhow::{anyhow, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{future::join_all, stream::SplitSink, FutureExt, SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, sync::Arc};
use sysinfo::System;
use tokio::sync::{mpsc, oneshot, Mutex};
use tracing::{error, info, warn};
use webrtc::{
    api::{
        media_engine::{MediaEngine, MIME_TYPE_H264, MIME_TYPE_OPUS},
        setting_engine::SettingEngine,
        APIBuilder,
    },
    ice::network_type::NetworkType,
    ice_transport::{
        ice_candidate::{RTCIceCandidate, RTCIceCandidateInit},
        ice_server::RTCIceServer,
    },
    peer_connection::{
        configuration::RTCConfiguration, sdp::session_description::RTCSessionDescription,
        RTCPeerConnection,
    },
    rtp_transceiver::rtp_codec::{RTCRtpCodecCapability, RTCRtpCodecParameters, RTPCodecType},
    track::track_local::{
        track_local_static_rtp::TrackLocalStaticRTP,
        track_local_static_sample::TrackLocalStaticSample, TrackLocal, TrackLocalWriter,
    },
};

use crate::{
    db,
    flow::manager_state::FlowManagerCommand,
    state::{AppState, MediaType},
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

#[derive(Serialize)]
struct StreamState {
    topic: String,
    is_online: bool,
}

#[derive(Deserialize)]
struct SubscribeStreamPayload {
    topic: String,
}

#[derive(Deserialize)]
struct FlowPayload {
    flow_id: i32,
}

#[derive(Serialize)]
struct FlowStatus {
    id: i32,
    name: String,
    is_running: bool,
}

enum ActorCommand {
    SetRemoteOffer {
        offer: RTCSessionDescription,
        responder: oneshot::Sender<Result<RTCSessionDescription>>,
    },
    SetRemoteAnswer {
        answer: RTCSessionDescription,
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
    GetAllStreamState {
        payload: serde_json::Value,
    },
    StopFlow {
        flow_id: i32,
    },
    GetAllFlows {
        responder: oneshot::Sender<Result<Vec<FlowStatus>>>,
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

struct WSActor {
    pc: Arc<RTCPeerConnection>,
    ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    receiver: mpsc::Receiver<ActorCommand>,
    state: Arc<AppState>,
    active_tracks: HashMap<String, Arc<dyn TrackLocal + Send + Sync>>,
}

impl WSActor {
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
                ActorCommand::SetRemoteAnswer { answer } => {
                    if let Err(e) = self.pc.set_remote_description(answer).await {
                        error!("Failed to set remote answer for renegotiation: {}", e);
                    } else {
                        info!("Renegotiation successful: Remote answer set.");
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
                ActorCommand::StopFlow { flow_id } => {
                    self.handle_stop_flow(flow_id).await;
                }
                ActorCommand::GetAllStreamState { payload } => {
                    self.handle_get_all_stream_state(payload).await;
                }
                ActorCommand::GetAllFlows { responder } => {
                    self.handle_get_all_flows(responder).await;
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

    async fn handle_get_all_flows(&self, responder: oneshot::Sender<Result<Vec<FlowStatus>>>) {
        let (manager_responder_tx, manager_responder_rx) = tokio::sync::oneshot::channel();
        let cmd = FlowManagerCommand::GetAllFlows {
            responder: manager_responder_tx,
            pool: self.state.pool.clone(),
        };

        if self.state.flow_manager_tx.send(cmd).await.is_err() {
            let _ = responder.send(Err(anyhow!("Failed to communicate with FlowManager")));
            return;
        }

        if let Ok(status_tuples) = manager_responder_rx.await {
            let all_db_flows = db::repository::get_all_flows(&self.state.pool).unwrap_or_default();
            let status_map: HashMap<i32, bool> = status_tuples.into_iter().collect();

            let result: Vec<FlowStatus> = all_db_flows
                .into_iter()
                .map(|f| FlowStatus {
                    id: f.id,
                    name: f.name,
                    is_running: *status_map.get(&f.id).unwrap_or(&false),
                })
                .collect();

            let _ = responder.send(Ok(result));
        } else {
            let _ = responder.send(Err(anyhow!("Failed to receive response from FlowManager")));
        }
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

    async fn handle_get_all_stream_state(&self, payload: serde_json::Value) {
        let stream_futures = self.state.streams.iter().map(|n| async move {
            StreamState {
                topic: n.topic.clone(),
                is_online: *n.is_online.read().await,
            }
        });

        let collected_streams: Vec<StreamState> = join_all(stream_futures).await;

        let ws_message = WsMessageOut {
            msg_type: "stream_state",
            payload: collected_streams,
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
        let Some(value) = payload.get("flow_id") else {
            error!("Missing flow_id in payload: {:?}", payload);
            return;
        };

        if !value.is_number() {
            error!("Invalid flow_id in payload: {:?}", payload);
            return;
        }

        let flow_id: i32 = value.as_i64().unwrap_or_default() as i32;

        let versions =
            db::repository::get_versions_for_flow(&self.state.pool, flow_id as i32).expect("msg");
        if versions.is_empty() {
            return;
        }

        let latest_version = versions[0].clone();
        let graph = match serde_json::from_str(&latest_version.graph_json) {
            Ok(g) => g,
            Err(e) => {
                error!("Failed to parse graph JSON for flow_id {}: {}", flow_id, e);
                return;
            }
        };

        println!("Start Flow");

        let cmd = FlowManagerCommand::StartFlow {
            flow_id,
            graph,
            broadcast_tx: self.state.broadcast_tx.clone(),
        };

        if self.state.flow_manager_tx.send(cmd).await.is_err() {
            error!("Failed to send StartFlow command to FlowManager.");
        }
    }

    async fn handle_stop_flow(&self, flow_id: i32) {
        let cmd = FlowManagerCommand::StopFlow { flow_id };
        if self.state.flow_manager_tx.send(cmd).await.is_err() {
            error!("Failed to send StopFlow command to FlowManager.");
        }
    }

    async fn handle_subscribe(&mut self, topic: String) {
        let mut subscribed = false;

        if self.active_tracks.contains_key(&topic) {
            warn!("Topic '{}' is already subscribed.", topic);
            return;
        }

        if let Some((ssrc, info)) = self
            .state
            .streams
            .iter()
            .find(|entry| {
                entry.value().topic == topic && entry.value().media_type == MediaType::Audio
            })
            .map(|entry| (*entry.key(), entry.value().clone()))
        {
            subscribed = true;
            info!(
                "[Audio] Subscribing to topic '{}' with SSRC {}",
                topic, ssrc
            );

            let new_audio_track = Arc::new(TrackLocalStaticRTP::new(
                RTCRtpCodecCapability {
                    mime_type: MIME_TYPE_OPUS.to_owned(),
                    ..Default::default()
                },
                format!("audio-{}", &topic),
                format!("webrtc-stream-audio-{}", &topic),
            ));

            let rtp_sender = self
                .pc
                .add_track(Arc::clone(&new_audio_track) as Arc<dyn TrackLocal + Send + Sync>)
                .await
                .unwrap();

            self.active_tracks.insert(
                topic.clone(),
                new_audio_track.clone() as Arc<dyn TrackLocal + Send + Sync>,
            );

            tokio::spawn(async move {
                let mut rtcp_buf = vec![0u8; 1500];
                while rtp_sender.read(&mut rtcp_buf).await.is_ok() {}
            });

            let mut rx = info.packet_tx.subscribe();
            let pc_clone = Arc::clone(&self.pc);

            tokio::spawn(async move {
                let audio_sender = pc_clone
                    .get_senders()
                    .await
                    .into_iter()
                    .find(|s| {
                        if let Some(track) = s.track().now_or_never().and_then(|t| t) {
                            track.id() == new_audio_track.id()
                        } else {
                            false
                        }
                    })
                    .expect("Audio sender not found for the specific track");

                let parameters = audio_sender.get_parameters().await;
                let negotiated_pt = parameters
                    .rtp_parameters
                    .codecs
                    .get(0)
                    .unwrap()
                    .payload_type;
                let negotiated_ssrc = parameters.encodings.get(0).unwrap().ssrc;

                info!(
                    "[Audio] RTP packet forwarding started. Negotiated PT: {}, SSRC: {}",
                    negotiated_pt, negotiated_ssrc
                );

                while let Ok(mut pkt) = rx.recv().await {
                    pkt.header.payload_type = negotiated_pt;
                    pkt.header.ssrc = negotiated_ssrc;

                    if new_audio_track.write_rtp(&pkt).await.is_err() {
                        warn!(
                            "[Audio] RTP packet write failed for SSRC {}, stopping.",
                            ssrc
                        );
                        break;
                    }
                }
                info!("[Audio] RTP packet forwarding stopped for SSRC: {}", ssrc);
            });
        }

        if let Some((ssrc, info)) = self
            .state
            .streams
            .iter()
            .find(|entry| {
                entry.value().topic == topic && entry.value().media_type == MediaType::Video
            })
            .map(|entry| (*entry.key(), entry.value().clone()))
        {
            subscribed = true;
            info!(
                "[Video-UDP] Subscribing to topic '{}' with SSRC {}",
                topic, ssrc
            );

            let new_udp_video_track = Arc::new(TrackLocalStaticRTP::new(
                RTCRtpCodecCapability {
                    mime_type: MIME_TYPE_H264.to_owned(),
                    ..Default::default()
                },
                format!("video-udp-{}", &topic),
                format!("webrtc-stream-udp-{}", &topic),
            ));

            let rtp_sender = self
                .pc
                .add_track(Arc::clone(&new_udp_video_track) as Arc<dyn TrackLocal + Send + Sync>)
                .await
                .unwrap();

            self.active_tracks.insert(
                topic.clone(),
                new_udp_video_track.clone() as Arc<dyn TrackLocal + Send + Sync>,
            );

            tokio::spawn(async move {
                let mut rtcp_buf = vec![0u8; 1500];
                while rtp_sender.read(&mut rtcp_buf).await.is_ok() {}
            });

            let mut rx = info.packet_tx.subscribe();
            let pc_clone = Arc::clone(&self.pc);

            tokio::spawn(async move {
                let video_sender = pc_clone
                    .get_senders()
                    .await
                    .into_iter()
                    .find(|s| {
                        if let Some(track) = s.track().now_or_never().and_then(|t| t) {
                            track.id() == new_udp_video_track.id()
                        } else {
                            false
                        }
                    })
                    .expect("Video sender not found for the specific UDP track");

                let parameters = video_sender.get_parameters().await;
                let negotiated_pt = parameters
                    .rtp_parameters
                    .codecs
                    .get(0)
                    .unwrap()
                    .payload_type;
                let negotiated_ssrc = parameters.encodings.get(0).unwrap().ssrc;

                info!(
                    "[Video-UDP] RTP packet forwarding started. Negotiated PT: {}, SSRC: {}",
                    negotiated_pt, negotiated_ssrc
                );

                while let Ok(mut pkt) = rx.recv().await {
                    pkt.header.payload_type = negotiated_pt;
                    pkt.header.ssrc = negotiated_ssrc;

                    if new_udp_video_track.write_rtp(&pkt).await.is_err() {
                        warn!(
                            "[Video-UDP] RTP packet write failed for SSRC {}, stopping.",
                            ssrc
                        );
                        break;
                    }
                }
                info!(
                    "[Video-UDP] RTP packet forwarding stopped for SSRC: {}",
                    ssrc
                );
            });
        }

        if self
            .state
            .topic_map
            .read()
            .await
            .iter()
            .any(|m| m.topic == topic && m.protocol == crate::state::Protocol::RTSP)
        {
            subscribed = true;
            info!("[Video] Subscribing to topic '{}'", topic);

            let new_rtsp_video_track = Arc::new(TrackLocalStaticSample::new(
                RTCRtpCodecCapability {
                    mime_type: MIME_TYPE_H264.to_owned(),
                    ..Default::default()
                },
                format!("video-rtsp-{}", &topic),
                format!("webrtc-stream-rtsp-{}", &topic),
            ));

            let rtp_sender = self
                .pc
                .add_track(Arc::clone(&new_rtsp_video_track) as Arc<dyn TrackLocal + Send + Sync>)
                .await
                .unwrap();

            self.active_tracks.insert(
                topic.clone(),
                new_rtsp_video_track.clone() as Arc<dyn TrackLocal + Send + Sync>,
            );

            tokio::spawn(async move {
                let mut rtcp_buf = vec![0u8; 1500];
                while rtp_sender.read(&mut rtcp_buf).await.is_ok() {}
            });

            let mut rx = self.state.rtsp_frame_tx.subscribe();
            let topic_clone = topic.clone();

            tokio::spawn(async move {
                info!(
                    "[Video] Frame forwarding started for topic: {}",
                    topic_clone
                );
                while let Ok(frame) = rx.recv().await {
                    if frame.topic == topic_clone {
                        let sample = webrtc::media::Sample {
                            data: frame.buffer.clone(),
                            duration: std::time::Duration::from_millis(33),
                            ..Default::default()
                        };
                        if new_rtsp_video_track.write_sample(&sample).await.is_err() {
                            warn!(
                                "[Video] Frame write failed for topic {}, stopping.",
                                topic_clone
                            );
                            break;
                        }
                    }
                }
                info!(
                    "[Video] Frame forwarding stopped for topic: {}",
                    topic_clone
                );
            });
        }

        if subscribed {
            info!("Track added. Starting renegotiation...");
            match self.pc.create_offer(None).await {
                Ok(offer) => {
                    if self.pc.set_local_description(offer).await.is_ok() {
                        if let Some(local_desc) = self.pc.local_description().await {
                            let msg = WsMessageOut {
                                msg_type: "offer",
                                payload: local_desc,
                            };
                            if let Ok(payload_str) = serde_json::to_string(&msg) {
                                if self
                                    .ws_sender
                                    .lock()
                                    .await
                                    .send(Message::Text(payload_str))
                                    .await
                                    .is_err()
                                {
                                    error!("Failed to send renegotiation offer to client.");
                                } else {
                                    info!("Renegotiation offer sent to client.");
                                }
                            }
                        }
                    }
                }
                Err(e) => error!("Failed to create renegotiation offer: {}", e),
            }
        } else {
            warn!(
                "Could not find any stream to subscribe for topic: {}",
                topic
            );
        }
    }
}

pub async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
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

    let mut broadcast_rx = state.broadcast_tx.subscribe();
    let ws_sender_broadcast = Arc::clone(&ws_sender);
    tokio::spawn(async move {
        while let Ok(msg) = broadcast_rx.recv().await {
            if ws_sender_broadcast
                .lock()
                .await
                .send(Message::Text(msg))
                .await
                .is_err()
            {
                break;
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
                        channels: 1,
                        sdp_fmtp_line: "minptime=10;useinbandfec=1".to_owned(),
                        ..Default::default()
                    },
                    // payload_type: 96,
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
                    // payload_type: 102,
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

            let actor = WSActor {
                pc,
                ws_sender,
                receiver: cmd_rx,
                state: Arc::clone(&state),
                active_tracks: HashMap::new(),
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
                "answer" => {
                    if let Ok(answer) = serde_json::from_value(ws_msg.payload) {
                        let cmd = ActorCommand::SetRemoteAnswer { answer };
                        if cmd_tx.send(cmd).await.is_err() {
                            break;
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
                "get_all_stream_state" => {
                    let cmd = ActorCommand::GetAllStreamState {
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
                "stop_flow" => {
                    if let Ok(payload) = serde_json::from_value::<FlowPayload>(ws_msg.payload) {
                        let cmd = ActorCommand::StopFlow {
                            flow_id: payload.flow_id,
                        };
                        if cmd_tx.send(cmd).await.is_err() {
                            break;
                        }
                    }
                }
                "get_all_flows" => {
                    let (responder_tx, responder_rx) = oneshot::channel();
                    let cmd = ActorCommand::GetAllFlows {
                        responder: responder_tx,
                    };
                    if cmd_tx.send(cmd).await.is_err() {
                        break;
                    }
                    if let Ok(Ok(flows)) = responder_rx.await {
                        let ws_response = WsMessageOut {
                            msg_type: "get_all_flows_response",
                            payload: &flows,
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
