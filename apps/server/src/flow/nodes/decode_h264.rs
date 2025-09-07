use anyhow::{anyhow, Result};
use async_trait::async_trait;
use gstreamer::{self as gst, glib};
use gstreamer::prelude::*;
use gstreamer_app::{AppSink, AppSrc};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex};
use tracing::{error, info, warn};

use super::{ExecutableNode, ExecutionResult};
use crate::flow::engine::ExecutionContext;

pub struct DecodeH264Node {
    appsrc: AppSrc,
    frame_rx: Arc<Mutex<mpsc::Receiver<Vec<u8>>>>,
    pipeline: gst::Pipeline,
}

impl DecodeH264Node {
    pub fn new() -> Result<Self> {
        gst::init()?;

        let pipeline_str = "appsrc name=mysource ! rtph264depay ! h264parse config-interval=-1 ! appsink name=mysink";
        let pipeline = gst::parse::launch(pipeline_str)?
            .downcast::<gst::Pipeline>()
            .map_err(|_| anyhow!("Failed to downcast GStreamer pipeline"))?;

        let appsrc = pipeline
            .by_name("mysource")
            .ok_or_else(|| anyhow!("Failed to get 'appsrc' from pipeline"))?
            .downcast::<AppSrc>()
            .map_err(|_| anyhow!("Failed to downcast 'appsrc' element"))?;
        
        appsrc.set_property("is-live", true);
        appsrc.set_property("format", gst::Format::Time);
        appsrc.set_property("do-timestamp", true);

        let caps = gst::Caps::builder("application/x-rtp")
            .field("media", "video")
            .field("clock-rate", 90000)
            .field("encoding-name", "H264")
            .build();
        appsrc.set_caps(Some(&caps));

        let appsink = pipeline
            .by_name("mysink")
            .ok_or_else(|| anyhow!("Failed to get 'appsink' from pipeline"))?
            .downcast::<AppSink>()
            .map_err(|_| anyhow!("Failed to downcast 'appsink' element"))?;

        let (frame_tx, frame_rx) = mpsc::channel::<Vec<u8>>(5);

        appsink.set_callbacks(
            gstreamer_app::AppSinkCallbacks::builder()
                .new_sample(move |sink| {
                    let sample = sink.pull_sample().map_err(|_| gst::FlowError::Eos)?;
                    let buffer = sample.buffer().ok_or(gst::FlowError::Error)?;
                    let map = buffer.map_readable().map_err(|_| gst::FlowError::Error)?;
                    
                    if let Err(e) = frame_tx.try_send(map.as_slice().to_vec()) {
                        warn!("Failed to send frame from GStreamer thread, channel might be full or closed: {}", e);
                    }
                    
                    Ok(gst::FlowSuccess::Ok)
                })
                .build(),
        );

        let bus = pipeline.bus()
            .ok_or_else(|| anyhow!("Failed to get GStreamer bus from pipeline"))?;

        bus.add_watch(move |_, msg| {
            match msg.view() {
                gst::MessageView::Error(err) => {
                    error!(
                        "GStreamer pipeline error: {}, Debug: {:?}",
                        err.error(),
                        err.debug()
                    );
                }
                gst::MessageView::Eos(_) => {
                    info!("GStreamer pipeline reached End-Of-Stream.");
                }
                _ => {}
            }
            glib::ControlFlow::Continue
        })?;

        pipeline.set_state(gst::State::Playing)?;

        // FIX: 파이프라인의 상태가 'Playing'으로 완전히 전환될 때까지 최대 5초간 기다립니다.
        pipeline.state(gst::ClockTime::from_seconds(5)).0
            .map_err(|err| anyhow!("Failed to set pipeline to Playing: {}", err))?;

        Ok(Self {
            appsrc,
            frame_rx: Arc::new(Mutex::new(frame_rx)),
            pipeline,
        })
    }
}

#[async_trait]
impl ExecutableNode for DecodeH264Node {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let encoded_packet = inputs
            .get("payload")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("'payload' input missing or not a string"))?;

        let rtp_packet_data = base64::decode(encoded_packet)?;
        
        let buffer = gst::Buffer::from_slice(rtp_packet_data);
        self.appsrc.push_buffer(buffer).map_err(|e| anyhow!("Failed to push buffer to GStreamer appsrc: {}", e))?;

        let mut frame_rx = self.frame_rx.lock().await;

        match frame_rx.try_recv() {
            Ok(frame_data) => {
                let frame_base64 = base64::encode(&frame_data);
                let mut outputs = HashMap::new();
                outputs.insert("frame".to_string(), json!(frame_base64));
                println!("send");
                Ok(ExecutionResult {
                    outputs,
                    ..Default::default()
                })
            }
            Err(mpsc::error::TryRecvError::Empty) => {
                Ok(ExecutionResult::default())
            }
            Err(e) => {
                Err(anyhow!("MPSC channel error in DecodeH264Node: {}", e))
            }
        }
    }
}

impl Drop for DecodeH264Node {
    fn drop(&mut self) {
        let _ = self.pipeline.set_state(gst::State::Null);
    }
}