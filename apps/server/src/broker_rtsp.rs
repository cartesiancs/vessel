use anyhow::{anyhow, Error, Result};
use futures_util::StreamExt;
use gstreamer::prelude::*;
use gstreamer_app::{AppSink, AppSinkCallbacks};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, RwLock,
};
use tokio::sync::{broadcast, watch};
use tokio::time::Instant;
use tracing::{error, info, warn};
use webrtc::rtp::packet::Packet;
use webrtc::util::Unmarshal;

use crate::state::{AppState, MediaType, Protocol, StreamInfo};

pub async fn start_rtsp_pipelines(
    app_state: Arc<AppState>,
    shutdown_rx: watch::Receiver<()>,
) -> Result<()> {
    if let Err(e) = gstreamer::init() {
        error!("Failed to initialize GStreamer: {}", e);
        return Ok(());
    }

    let topic_map = app_state.topic_map.read().await;
    let rtsp_mappings: Vec<_> = topic_map
        .iter()
        .filter(|mapping| mapping.protocol == Protocol::RTSP)
        .cloned()
        .collect();
    drop(topic_map);

    if rtsp_mappings.is_empty() {
        info!("No RTSP streams found in topic map.");
        return Ok(());
    }

    info!("Found {} RTSP streams to launch.", rtsp_mappings.len());
    let mut join_set = tokio::task::JoinSet::new();

    for mapping in rtsp_mappings {
        let state = Arc::clone(&app_state);
        let topic = mapping.topic.clone();
        let user_id = mapping.entity_id.clone();
        let mut shutdown_rx = shutdown_rx.clone();

        let (packet_tx, _) = broadcast::channel(1024);

        join_set.spawn(async move {
            loop {
                let mut shutdown_rx_clone = shutdown_rx.clone();
                let pipeline_future = run_pipeline(
                    &topic,
                    &user_id,
                    packet_tx.clone(),
                    Arc::clone(&state),
                    &mut shutdown_rx_clone,
                );

                tokio::select! {
                    _ = shutdown_rx.changed() => {
                        info!("Shutdown signal received, stopping pipeline loop for {}", topic);
                        break;
                    }
                    pipeline_result = pipeline_future => {
                        match pipeline_result {
                            Ok(_) => {
                                info!("Pipeline for {} finished gracefully.", topic);
                                break;
                            }
                            Err(e) => {
                                error!("Error in pipeline for {}. Restarting...: {}", topic, e);
                                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                            }
                        }
                    }
                }
            }
        });
    }

    while let Some(res) = join_set.join_next().await {
        if let Err(e) = res {
            error!("A pipeline task failed: {}", e);
        }
    }

    info!("All RTSP pipelines have shut down.");
    Ok(())
}

async fn run_pipeline(
    rtsp_url: &str,
    user_id: &str,
    packet_tx: broadcast::Sender<Packet>,
    state: Arc<AppState>,
    shutdown_rx: &mut watch::Receiver<()>,
) -> Result<(), Error> {
    let pipeline_str = format!(
        "rtspsrc location={} latency=0 ! application/x-rtp,media=video,encoding-name=H264 ! appsink name=sink emit-signals=true",
        rtsp_url
    );

    let pipeline = gstreamer::parse::launch(&pipeline_str)?;
    let pipeline_bin = pipeline
        .downcast::<gstreamer::Bin>()
        .map_err(|_| anyhow!("Pipeline element is not a Bin"))?;
    let appsink = pipeline_bin
        .by_name("sink")
        .ok_or_else(|| anyhow!("Failed to get sink element"))?
        .downcast::<AppSink>()
        .map_err(|_| anyhow!("Sink element is not an AppSink"))?;

    let is_registered = Arc::new(AtomicBool::new(false));
    let rtsp_url_clone = rtsp_url.to_string();
    let user_id_clone = user_id.to_string();

    appsink.set_callbacks(
        AppSinkCallbacks::builder()
            .new_sample(move |sink| {
                let sample = sink.pull_sample().map_err(|_| gstreamer::FlowError::Eos)?;
                let buffer = sample.buffer().ok_or(gstreamer::FlowError::Error)?;
                let map = buffer
                    .map_readable()
                    .map_err(|_| gstreamer::FlowError::Error)?;

                match Packet::unmarshal(&mut map.as_slice()) {
                    Ok(packet) => {
                        let ssrc: u32 = packet.header.ssrc;

                        if !is_registered.load(Ordering::SeqCst) {
                            info!(
                                "RTSP stream {} registered with SSRC: {}",
                                rtsp_url_clone, ssrc
                            );

                            let stream_info = StreamInfo {
                                topic: rtsp_url_clone.clone(),
                                user_id: user_id_clone.clone(),
                                packet_tx: packet_tx.clone(),
                                media_type: MediaType::Video,
                                last_seen: Arc::new(RwLock::new(Instant::now())),
                                is_online: Arc::new(RwLock::new(true)),
                            };
                            state.streams.insert(ssrc, stream_info);
                            is_registered.store(true, Ordering::SeqCst);
                        }

                        if let Some(stream_info) = state.streams.get(&ssrc) {
                            *stream_info.last_seen.write().unwrap() = Instant::now();
                        }

                        if packet_tx.send(packet).is_err() {
                            // Receiver is gone, maybe log this.
                        }
                    }
                    Err(e) => {
                        warn!("Failed to unmarshal RTP packet from GStreamer: {}", e);
                    }
                }
                Ok(gstreamer::FlowSuccess::Ok)
            })
            .build(),
    );

    pipeline_bin.set_state(gstreamer::State::Playing)?;
    let bus = pipeline_bin.bus().unwrap();
    let mut bus_stream = bus.stream();

    loop {
        tokio::select! {
            _ = shutdown_rx.changed() => {
                info!("Shutdown signal received in run_pipeline for {}. Sending EOS.", rtsp_url);
                if !pipeline_bin.send_event(gstreamer::event::Eos::new()) {
                    warn!("Failed to send EOS to pipeline {}", rtsp_url);
                }
                break;
            }
            maybe_msg = bus_stream.next() => {
                match maybe_msg {
                    Some(msg) => {
                        use gstreamer::MessageView;
                        match msg.view() {
                            MessageView::Error(err) => {
                                error!("Error from pipeline {}: {} ({})", rtsp_url, err.error(), err.debug().unwrap_or_default());
                                pipeline_bin.set_state(gstreamer::State::Null)?;
                                return Err(anyhow!("Pipeline error: {}", err.error()));
                            }
                            MessageView::Eos(_) => {
                                info!("End of stream for {}", rtsp_url);
                                break;
                            }
                            _ => (),
                        }
                    }
                    None => {
                        info!("Bus stream ended for {}", rtsp_url);
                        break;
                    }
                }
            }
        }
    }

    pipeline_bin.set_state(gstreamer::State::Null)?;
    info!("Pipeline for {} has been set to NULL state.", rtsp_url);
    Ok(())
}
