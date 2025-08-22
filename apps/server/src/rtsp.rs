

use anyhow::{anyhow, Result};
use crossbeam_channel::{bounded, Receiver, Sender};
use gstreamer::prelude::*;
use gstreamer_app::{prelude::*, AppSink, AppSinkCallbacks};
use std::sync::Arc;
use tokio::task::JoinSet;
use tracing::{error, info, warn};
use anyhow::Error;

use crate::state::{AppState, Protocol};

#[derive(Debug)]
pub struct FrameData {
    pub stream_uri: String,
    pub buffer: Vec<u8>,
    pub width: i32,
    pub height: i32,
}

pub struct RtspManager {
    pub frame_rx: Receiver<FrameData>,
}

impl RtspManager {
    pub fn new() -> (Self, Sender<FrameData>) {
        let (frame_tx, frame_rx) = bounded(100);
        (Self { frame_rx }, frame_tx)
    }
}

pub async fn start_rtsp_pipelines(
    app_state: Arc<AppState>,
    frame_tx: Sender<FrameData>,
) {
    if let Err(e) = gstreamer::init() {
        eprintln!("Failed to initialize GStreamer: {}", e);
        return;
    }

    let topic_map = app_state.topic_map.read().await;

    let rtsp_mappings: Vec<_> = topic_map
        .iter()
        .filter(|mapping| mapping.protocol == Protocol::RTSP)
        .cloned() 
        .collect();
    
    drop(topic_map);

    if rtsp_mappings.is_empty() {
        println!("No RTSP streams found in topic map.");
        return;
    }

    println!("Found {} RTSP streams to launch.", rtsp_mappings.len());

    for mapping in rtsp_mappings {
        let tx = frame_tx.clone();

        tokio::spawn(async move {
            println!("🚀 Launching pipeline for: {}", mapping.topic);
            
            if let Err(e) = run_pipeline(&mapping.topic, tx).await {
                eprintln!("Error in pipeline for {}: {}", mapping.topic, e);
            }
        });
    }
}

async fn run_pipeline(rtsp_url: &str, frame_tx: Sender<FrameData>) -> Result<(), Error> {
    let pipeline_str = format!(
        "rtspsrc location={0} latency=0 ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! videoscale ! video/x-raw,format=RGB ! appsink name=sink emit-signals=true",
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

    let rtsp_url_clone = rtsp_url.to_string();
    appsink.set_callbacks(
        AppSinkCallbacks::builder()
            .new_sample(move |sink| {
                let sample = sink.pull_sample().map_err(|_| gstreamer::FlowError::Eos)?;
                let buffer = sample.buffer().ok_or(gstreamer::FlowError::Error)?;
                let caps = sample.caps().ok_or(gstreamer::FlowError::Error)?;
                let s = caps.structure(0).ok_or(gstreamer::FlowError::Error)?;
                let width = s.get::<i32>("width").map_err(|_| gstreamer::FlowError::Error)?;
                let height = s.get::<i32>("height").map_err(|_| gstreamer::FlowError::Error)?;
                
                let map = buffer.map_readable().map_err(|_| gstreamer::FlowError::Error)?;
                
                let frame_data = FrameData {
                    stream_uri: rtsp_url_clone.clone(),
                    buffer: map.as_slice().to_vec(),
                    width,
                    height,
                };
                
                if let Err(e) = frame_tx.try_send(frame_data) {
                    warn!("Failed to send frame data: {}", e);
                }

                Ok(gstreamer::FlowSuccess::Ok)
            })
            .build(),
    );

    pipeline_bin.set_state(gstreamer::State::Playing)?;

    let bus = pipeline_bin.bus().unwrap();
    for msg in bus.iter_timed(gstreamer::ClockTime::NONE) {
        use gstreamer::MessageView;
        match msg.view() {
            MessageView::Error(err) => {
                error!("Error from pipeline {}: {} ({})",
                    rtsp_url,
                    err.error(),
                    err.debug().unwrap_or_default()
                );
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

    pipeline_bin.set_state(gstreamer::State::Null)?;
    Ok(())
}