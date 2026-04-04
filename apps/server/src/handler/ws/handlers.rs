use anyhow::{anyhow, Result};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{future::join_all, stream::SplitSink, FutureExt, SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc};
use sysinfo::System;
use tokio::sync::{mpsc, oneshot, Mutex};
use tracing::{error, info, warn};
use webrtc::{
    api::media_engine::{MIME_TYPE_H264, MIME_TYPE_OPUS},
    ice_transport::{
        ice_candidate::RTCIceCandidateInit,
        ice_connection_state::RTCIceConnectionState,
    },
    peer_connection::{
        offer_answer_options::RTCOfferOptions,
        sdp::session_description::RTCSessionDescription,
        RTCPeerConnection,
    },
    rtp_transceiver::rtp_codec::RTCRtpCodecCapability,
    track::track_local::{
        track_local_static_rtp::TrackLocalStaticRTP,
        TrackLocal, TrackLocalWriter,
    },
};

use crate::handler::ws::WsMessageOut;

use crate::{
    db,
    flow::{
        manager_state::FlowManagerCommand,
        types::FlowRunContext,
    },
    handler::ws::webrtc::create_peer_connection,
    state::{AppState, MediaType},
};

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
    Hangup,
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
                    info!("Adding ICE candidate to PC: {}", candidate.candidate);
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
                ActorCommand::Hangup => {
                    info!("Received Hangup. Resetting PeerConnection.");
                    if let Err(e) = self.pc.close().await {
                        error!("Failed to close peer connection: {}", e);
                    }
                    self.active_tracks.clear();

                    match create_peer_connection(Arc::clone(&self.ws_sender), &self.state.pool).await {
                        Ok(new_pc) => {
                            self.pc = new_pc;
                            info!("PeerConnection has been successfully reset.");
                        }
                        Err(e) => {
                            error!("Failed to create a new peer connection after hangup: {}", e);
                            break;
                        }
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
        let stream_futures = self.state.streams.iter().map(|entry| async move {
            let stream = entry.value();
            StreamState {
                topic: stream.descriptor.topic.clone(),
                is_online: *stream.is_online.read().unwrap(),
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
        info!("[handle_offer] Setting remote description...");
        pc.set_remote_description(offer).await?;
        info!("[handle_offer] Creating answer...");
        let answer = pc.create_answer(None).await?;
        info!("[handle_offer] Setting local description (triggers ICE gathering)...");
        pc.set_local_description(answer).await?;
        info!("[handle_offer] Local description set successfully.");
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

        let run_context = payload
            .get("run_context")
            .and_then(|rc| rc.get("session_id"))
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| FlowRunContext {
                session_id: s.to_string(),
            });

        let cmd = FlowManagerCommand::StartFlow {
            flow_id,
            graph,
            broadcast_tx: self.state.broadcast_tx.clone(),
            run_context,
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

    fn extract_ice_credentials(sdp: &str) -> Option<(String, String)> {
        let mut ufrag = None;
        let mut pwd = None;
        for line in sdp.lines() {
            if line.starts_with("a=ice-ufrag:") {
                ufrag = Some(line["a=ice-ufrag:".len()..].to_string());
            } else if line.starts_with("a=ice-pwd:") {
                pwd = Some(line["a=ice-pwd:".len()..].to_string());
            }
            if ufrag.is_some() && pwd.is_some() {
                break;
            }
        }
        ufrag.zip(pwd)
    }

    fn patch_ice_credentials(sdp: &str, ufrag: &str, pwd: &str) -> String {
        let mut result = String::with_capacity(sdp.len());
        for line in sdp.lines() {
            if line.starts_with("a=ice-ufrag:") {
                result.push_str(&format!("a=ice-ufrag:{}", ufrag));
            } else if line.starts_with("a=ice-pwd:") {
                result.push_str(&format!("a=ice-pwd:{}", pwd));
            } else {
                result.push_str(line);
            }
            result.push_str("\r\n");
        }
        result
    }

    /// H.264 RTP 패킷이 키프레임(IDR)을 포함하는지 감지.
    /// NAL 유닛 타입을 검사: Single NAL(5=IDR, 7=SPS), STAP-A(24), FU-A(28).
    fn is_h264_keyframe(pkt: &webrtc::rtp::packet::Packet) -> bool {
        if pkt.payload.is_empty() {
            return false;
        }
        let nal_type = pkt.payload[0] & 0x1F;
        match nal_type {
            5 | 7 => true, // IDR slice or SPS
            24 => {
                // STAP-A: 내부 NAL 중 IDR(5) 또는 SPS(7) 포함 여부
                let mut offset = 1;
                while offset + 2 < pkt.payload.len() {
                    let nalu_size =
                        ((pkt.payload[offset] as usize) << 8) | (pkt.payload[offset + 1] as usize);
                    offset += 2;
                    if offset < pkt.payload.len() {
                        let inner_nal_type = pkt.payload[offset] & 0x1F;
                        if inner_nal_type == 5 || inner_nal_type == 7 {
                            return true;
                        }
                    }
                    offset += nalu_size;
                }
                false
            }
            28 => {
                // FU-A: fragmented NAL — start bit + IDR type
                if pkt.payload.len() > 1 {
                    let fu_header = pkt.payload[1];
                    let start_bit = fu_header & 0x80 != 0;
                    let fu_nal_type = fu_header & 0x1F;
                    start_bit && (fu_nal_type == 5 || fu_nal_type == 7)
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    async fn handle_subscribe(&mut self, topic: String) {
        let mut subscribed = false;

        if self.active_tracks.contains_key(&topic) {
            warn!("Topic '{}' is already subscribed.", topic);
            return;
        }

        let audio_stream_info = self
            .state
            .streams
            .iter()
            .find(|entry| {
                entry.value().descriptor.topic == topic
                    && entry.value().descriptor.media_type == MediaType::Audio
            })
            .map(|entry| (*entry.key(), entry.value().clone()));

        let video_stream_info = self
            .state
            .streams
            .iter()
            .find(|entry| {
                entry.value().descriptor.topic == topic
                    && entry.value().descriptor.media_type == MediaType::Video
            })
            .map(|entry| (*entry.key(), entry.value().clone()));

        if let Some((ssrc, info)) = audio_stream_info {
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

            let audio_sender = self.pc
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
                "[Audio] RTP forwarding ready. Negotiated PT: {}, SSRC: {}",
                negotiated_pt, negotiated_ssrc
            );

            tokio::spawn(async move {
                let mut lag_count: u64 = 0;
                loop {
                    match rx.recv().await {
                        Ok(mut pkt) => {
                            pkt.header.payload_type = negotiated_pt;
                            pkt.header.ssrc = negotiated_ssrc;

                            if let Err(e) = new_audio_track.write_rtp(&pkt).await {
                                warn!(
                                    "[Audio] write_rtp failed for SSRC {}: {}. Stopping.",
                                    ssrc, e
                                );
                                break;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            lag_count += n;
                            warn!(
                                "[Audio] Broadcast receiver lagged {} packets (total: {}) for SSRC {}",
                                n, lag_count, ssrc
                            );
                            continue;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            info!("[Audio] Broadcast channel closed for SSRC {}", ssrc);
                            break;
                        }
                    }
                }
                info!("[Audio] RTP packet forwarding stopped for SSRC: {} (total lagged: {})", ssrc, lag_count);
            });
        }

        if let Some((ssrc, info)) = video_stream_info {
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

            let video_sender = self.pc
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
                "[Video-UDP] RTP forwarding ready. Negotiated PT: {}, SSRC: {}",
                negotiated_pt, negotiated_ssrc
            );

            tokio::spawn(async move {
                let mut lag_count: u64 = 0;
                // 새 구독자는 키프레임(IDR)을 받을 때까지 대기
                let mut waiting_for_keyframe = true;
                info!("[Video-UDP] Waiting for keyframe before forwarding SSRC {}", ssrc);
                loop {
                    match rx.recv().await {
                        Ok(mut pkt) => {
                            if waiting_for_keyframe {
                                if WSActor::is_h264_keyframe(&pkt) {
                                    waiting_for_keyframe = false;
                                    info!("[Video-UDP] Keyframe detected, starting forwarding for SSRC {}", ssrc);
                                } else {
                                    continue; // 키프레임이 아니면 스킵
                                }
                            }

                            pkt.header.payload_type = negotiated_pt;
                            pkt.header.ssrc = negotiated_ssrc;

                            if let Err(e) = new_udp_video_track.write_rtp(&pkt).await {
                                warn!(
                                    "[Video-UDP] write_rtp failed for SSRC {}: {}. Stopping.",
                                    ssrc, e
                                );
                                break;
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                            lag_count += n;
                            waiting_for_keyframe = true; // 패킷 드롭 후 키프레임 대기
                            warn!(
                                "[Video-UDP] Broadcast receiver lagged {} packets (total: {}) for SSRC {}, waiting for keyframe",
                                n, lag_count, ssrc
                            );
                            continue;
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                            info!("[Video-UDP] Broadcast channel closed for SSRC {}", ssrc);
                            break;
                        }
                    }
                }
                info!(
                    "[Video-UDP] RTP packet forwarding stopped for SSRC: {} (total lagged: {})",
                    ssrc, lag_count
                );
            });
        }

        if subscribed {
            let ice_state = self.pc.ice_connection_state();
            let ice_restart = matches!(
                ice_state,
                RTCIceConnectionState::Failed | RTCIceConnectionState::Disconnected
            );
            let offer_options = if ice_restart {
                info!("ICE is {:?}, triggering ICE restart in renegotiation offer", ice_state);
                Some(RTCOfferOptions {
                    ice_restart: true,
                    ..Default::default()
                })
            } else {
                None
            };

            // webrtc-rs 버그 워크어라운드: set_local_description()이 ICE agent의 local credentials를
            // 업데이트하지 않으므로, ICE restart가 아닌 renegotiation에서는 기존 credentials를 보존해야 함.
            // ICE restart 시에는 ICE agent가 새 credentials로 restart되므로 패칭하지 않음.
            let current_creds = if !ice_restart {
                self.pc.local_description().await
                    .and_then(|desc| Self::extract_ice_credentials(&desc.sdp))
            } else {
                None
            };

            info!("Track added. Starting renegotiation (ice_restart={})...", ice_restart);
            match self.pc.create_offer(offer_options).await {
                Ok(offer) => {
                    let final_offer = if let Some((ref ufrag, ref pwd)) = current_creds {
                        let patched_sdp = Self::patch_ice_credentials(&offer.sdp, ufrag, pwd);
                        info!("Patched renegotiation offer with existing ICE credentials (ufrag={})", ufrag);
                        RTCSessionDescription::offer(patched_sdp).unwrap()
                    } else {
                        offer
                    };

                    if self.pc.set_local_description(final_offer).await.is_ok() {
                        if let Some(local_desc) = self.pc.local_description().await {
                            let send_desc = if let Some((ref ufrag, ref pwd)) = current_creds {
                                let patched_sdp = Self::patch_ice_credentials(&local_desc.sdp, ufrag, pwd);
                                RTCSessionDescription::offer(patched_sdp).unwrap()
                            } else {
                                local_desc
                            };
                            let msg = WsMessageOut {
                                msg_type: "offer",
                                payload: send_desc,
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

    let initial_pc = match create_peer_connection(Arc::clone(&ws_sender), &state.pool).await {
        Ok(pc) => pc,
        Err(e) => {
            error!("Failed to create initial peer connection: {}", e);
            return;
        }
    };

    tokio::spawn({
        let state = Arc::clone(&state);
        let ws_sender = Arc::clone(&ws_sender);

        async move {
            let actor = WSActor {
                pc: initial_pc,
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
                        // Spawn response handling so the WS loop can immediately
                        // continue reading messages (critical for ICE candidates).
                        let ws_sender_clone = Arc::clone(&ws_sender);
                        tokio::spawn(async move {
                            if let Ok(Ok(answer)) = responder_rx.await {
                                let ws_answer = WsMessageOut {
                                    msg_type: "answer",
                                    payload: &answer,
                                };
                                if let Ok(payload_str) = serde_json::to_string(&ws_answer) {
                                    let _ = ws_sender_clone
                                        .lock()
                                        .await
                                        .send(Message::Text(payload_str))
                                        .await;
                                }
                            }
                        });
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
                    match serde_json::from_value::<RTCIceCandidateInit>(ws_msg.payload.clone()) {
                        Ok(candidate) => {
                            info!("Received ICE candidate from client: {}", candidate.candidate);
                            let cmd = ActorCommand::AddIceCandidate { candidate };
                            if cmd_tx.send(cmd).await.is_err() {
                                break;
                            }
                        }
                        Err(e) => {
                            error!("Failed to deserialize ICE candidate: {}. Payload: {}", e, ws_msg.payload);
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
                    let ws_sender_clone = Arc::clone(&ws_sender);
                    tokio::spawn(async move {
                        if let Ok(Ok(flows)) = responder_rx.await {
                            let ws_response = WsMessageOut {
                                msg_type: "get_all_flows_response",
                                payload: &flows,
                            };
                            if let Ok(payload_str) = serde_json::to_string(&ws_response) {
                                let _ = ws_sender_clone
                                    .lock()
                                    .await
                                    .send(Message::Text(payload_str))
                                    .await;
                            }
                        }
                    });
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
                    let ws_sender_clone = Arc::clone(&ws_sender);
                    tokio::spawn(async move {
                        if let Ok(Ok(stats)) = responder_rx.await {
                            let ws_response = WsMessageOut {
                                msg_type: "get_server",
                                payload: &stats,
                            };
                            if let Ok(payload_str) = serde_json::to_string(&ws_response) {
                                let _ = ws_sender_clone
                                    .lock()
                                    .await
                                    .send(Message::Text(payload_str))
                                    .await;
                            }
                        }
                    });
                }
                "hangup" => {
                    info!("Received hangup message from client.");
                    let cmd = ActorCommand::Hangup;
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
