use anyhow::{anyhow, Error, Result};
use async_trait::async_trait;
use futures_util::StreamExt;
use gstreamer::prelude::*;
use gstreamer_app::{AppSink, AppSinkCallbacks};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use tokio::sync::{broadcast, watch, RwLock};
use tokio::task::JoinSet;
use tokio::time::Instant;
use tracing::{error, info, warn};
use webrtc::rtp::packet::Packet;
use webrtc::util::Unmarshal;

use crate::media::adapter::MediaAdapter;
use crate::state::{MediaType, Protocol, StreamDescriptor, StreamManager, TopicMapping};

pub struct RtspPullAdapter {
    streams: StreamManager,
    topic_map: Arc<RwLock<Vec<TopicMapping>>>,
}

impl RtspPullAdapter {
    pub fn new(streams: StreamManager, topic_map: Arc<RwLock<Vec<TopicMapping>>>) -> Self {
        Self { streams, topic_map }
    }

    async fn start_pipelines(&self, mut shutdown_rx: watch::Receiver<()>) -> Result<()> {
        if let Err(e) = gstreamer::init() {
            error!("Failed to initialize GStreamer: {}", e);
            return Ok(());
        }

        let topic_map = self.topic_map.read().await;
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
        let mut join_set = JoinSet::new();

        for mapping in rtsp_mappings {
            let topic = mapping.topic.clone();
            let user_id = mapping.entity_id.clone();
            let streams = self.streams.clone();
            let mut shutdown_rx = shutdown_rx.clone();
            let (packet_tx, _) = broadcast::channel(1024);

            join_set.spawn(async move {
                loop {
                    let mut shutdown_rx_clone = shutdown_rx.clone();
                    let pipeline_future = run_pipeline(
                        &topic,
                        &user_id,
                        packet_tx.clone(),
                        streams.clone(),
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
}

#[async_trait]
impl MediaAdapter for RtspPullAdapter {
    fn protocol(&self) -> Protocol {
        Protocol::RTSP
    }

    async fn start(&self, shutdown: watch::Receiver<()>) -> Result<()> {
        self.start_pipelines(shutdown).await
    }
}

async fn run_pipeline(
    rtsp_url: &str,
    user_id: &str,
    packet_tx: broadcast::Sender<Packet>,
    streams: StreamManager,
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
    let streams_for_cb = streams.clone();
    let packet_tx_for_cb = packet_tx.clone();

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

                            let descriptor = StreamDescriptor {
                                id: ssrc,
                                topic: rtsp_url_clone.clone(),
                                user_id: user_id_clone.clone(),
                                media_type: MediaType::Video,
                                protocol: Protocol::RTSP,
                            };
                            streams_for_cb.insert_with_sender(descriptor, packet_tx_for_cb.clone());
                            streams_for_cb.mark_online(ssrc);
                            is_registered.store(true, Ordering::SeqCst);
                        }

                        if let Some(stream_handle) = streams_for_cb.get_by_ssrc(ssrc) {
                            *stream_handle.last_seen.write().unwrap() = Instant::now();
                        }

                        if packet_tx_for_cb.send(packet).is_err() {
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
