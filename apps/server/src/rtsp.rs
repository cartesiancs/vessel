

use anyhow::{anyhow, Result};
use crossbeam_channel::{bounded, Receiver, Sender};
use gstreamer::prelude::*;
use gstreamer_app::prelude::*;
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
        tokio::spawn(async move {
            println!("🚀 Launching pipeline for: {}", mapping.topic);
            
            if let Err(e) = run_pipeline(&mapping.topic).await {
                eprintln!("Error in pipeline for {}: {}", mapping.topic, e);
            }
        });
    }
}

async fn run_pipeline(rtsp_url: &str) -> Result<(), Error> {
    let pipeline_str = format!(
        "rtspsrc location={} latency=0 ! rtph264depay ! h264parse ! avdec_h264 ! autovideosink",
        rtsp_url
    );

    let pipeline = gstreamer::parse::launch(&pipeline_str)?;

    pipeline.set_state(gstreamer::State::Playing)?;

    let bus = pipeline.bus().unwrap();

    for msg in bus.iter_timed(gstreamer::ClockTime::NONE) {
        match msg.view() {
            gstreamer::MessageView::Error(err) => {
                pipeline.set_state(gstreamer::State::Null)?;
                return Err(anyhow::anyhow!(""));
            }
            gstreamer::MessageView::Eos(_) => {
                println!("End of stream for {}", rtsp_url);
                break;
            }
            _ => (),
        }
    }

    pipeline.set_state(gstreamer::State::Null)?;
    Ok(())
}

async fn setup_and_run_pipeline(uri: &str, tx: Sender<FrameData>) -> Result<()> {
    let pipeline_str = format!(
        "rtspsrc location={} latency=0 ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! videoscale ! appsink name=sink caps=\"video/x-raw,format=RGB,pixel-aspect-ratio=1/1\"",
        uri
    );



    let pipeline = gstreamer::parse::launch(&pipeline_str)?;
    let pipeline = pipeline.dynamic_cast::<gstreamer::Pipeline>().unwrap();
    let appsink = pipeline
        .by_name("sink")
        .unwrap()
        .dynamic_cast::<gstreamer_app::AppSink>()
        .unwrap();

    let stream_uri = uri.to_string();
    appsink.set_callbacks(
        gstreamer_app::AppSinkCallbacks::builder()
            .new_sample(move |sink| {
                let sample = sink.pull_sample().map_err(|_| gstreamer::FlowError::Eos)?;
                let caps = sample.caps().ok_or(gstreamer::FlowError::Error)?;
                let s = caps.structure(0).ok_or(gstreamer::FlowError::Error)?;
                let width = s.get::<i32>("width").map_err(|_| gstreamer::FlowError::Error)?;
                let height = s.get::<i32>("height").map_err(|_| gstreamer::FlowError::Error)?;

                let buffer = sample.buffer().ok_or(gstreamer::FlowError::Error)?;
                let map = buffer.map_readable().map_err(|_| gstreamer::FlowError::Error)?;

                let frame_data = FrameData {
                    stream_uri: stream_uri.clone(),
                    buffer: map.to_vec(),
                    width,
                    height,
                };

                if tx.try_send(frame_data).is_err() {
                    // warn!("Frame channel is full, dropping frame from {}", stream_uri);
                }

                Ok(gstreamer::FlowSuccess::Ok)
            })
            .build(),
    );

    pipeline.set_state(gstreamer::State::Playing)?;

    let bus = pipeline.bus().unwrap();
    for msg in bus.iter_timed(gstreamer::ClockTime::NONE) {
        use gstreamer::MessageView;
        match msg.view() {
            MessageView::Error(err) => {
                let dbg = err.debug().unwrap_or_default();
                break;
            }
            MessageView::Eos(_) => {
                info!("End-of-Stream received for pipeline {}", uri);
                break;
            }
            _ => (),
        }
    }

    pipeline.set_state(gstreamer::State::Null)?;
    Ok(())
}