use anyhow::{anyhow, Result};
use async_trait::async_trait;
use gstreamer::prelude::*;
use gstreamer::{self as gst, glib};
use gstreamer_app::{AppSink, AppSrc};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tracing::{error, info, warn};
use webrtc::util::Marshal;

use super::{ExecutableNode, ExecutionResult};
use crate::flow::BinaryStore;
use crate::{
    flow::engine::{ExecutionContext, TriggerCommand},
    state::StreamManager,
};

#[derive(Deserialize, Debug, Clone)]
pub struct GstDecoderData {
    topic: String,
}

pub struct GstDecoderNode {
    data: GstDecoderData,
    stream_manager: StreamManager,
    binary_store: BinaryStore,
}

impl GstDecoderNode {
    pub fn new(
        node_data: &Value,
        stream_manager: StreamManager,
        binary_store: BinaryStore,
    ) -> Result<Self> {
        let data: GstDecoderData = serde_json::from_value(node_data.clone())?;
        Ok(Self {
            data,
            stream_manager,
            binary_store,
        })
    }
}

#[async_trait]
impl ExecutableNode for GstDecoderNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        Ok(ExecutionResult {
            outputs: inputs,
            ..Default::default()
        })
    }

    fn is_trigger(&self) -> bool {
        true
    }

    fn start_trigger(
        &self,
        node_id: String,
        trigger_tx: mpsc::Sender<TriggerCommand>,
    ) -> Result<JoinHandle<()>> {
        gst::init()?;
        let stream_info = self
            .stream_manager
            .iter()
            .find(|entry| entry.value().topic == self.data.topic)
            .map(|entry| entry.value().clone())
            .ok_or_else(|| anyhow!("Stream with topic '{}' not found", self.data.topic))?;

        let pipeline_str = "appsrc name=mysource ! rtph264depay ! avdec_h264 ! videoconvert ! video/x-raw,format=RGB ! appsink name=mysink";
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

        let bus = pipeline.bus().unwrap();
        bus.add_watch(move |_, msg| {
            match msg.view() {
                gst::MessageView::Error(err) => {
                    error!("GStreamer bus error: {}, {:?}", err.error(), err.debug());
                }
                gst::MessageView::Eos(_) => info!("GStreamer bus EOS."),
                _ => {}
            }
            glib::ControlFlow::Continue
        })?;

        pipeline.set_state(gst::State::Playing)?;
        pipeline
            .state(gst::ClockTime::from_seconds(5))
            .0
            .map_err(|err| anyhow!("Failed to set pipeline to Playing: {}", err))?;

        info!("GStreamer pipeline started for topic '{}'", self.data.topic);

        let binary_store = self.binary_store.clone();

        let handle = tokio::spawn(async move {
            let mut packet_rx = stream_info.packet_tx.subscribe();

            appsink.set_callbacks(
                gstreamer_app::AppSinkCallbacks::builder()
                    .new_sample(move |sink| {
                        let sample = sink.pull_sample().map_err(|_| gst::FlowError::Eos)?;
                        let buffer = sample.buffer().ok_or(gst::FlowError::Error)?;
                        let caps = sample.caps().ok_or(gst::FlowError::Error)?;
                        let s = caps.structure(0).ok_or(gst::FlowError::Error)?;
                        let width =
                            s.get::<i32>("width").map_err(|_| gst::FlowError::Error)? as u32;
                        let height =
                            s.get::<i32>("height").map_err(|_| gst::FlowError::Error)? as u32;

                        let map = buffer.map_readable().map_err(|_| gst::FlowError::Error)?;
                        let frame_bytes = map.as_slice().to_vec();

                        let frame_id = binary_store.insert(frame_bytes);

                        let frame_output = json!({
                               "type": "binary_pointer",
                            "id": frame_id.to_string(),
                            "width": width,
                            "height": height,
                        });

                        let mut inputs = HashMap::new();
                        inputs.insert("frame".to_string(), frame_output);

                        let cmd = TriggerCommand {
                            node_id: node_id.clone(),
                            inputs,
                        };

                        if trigger_tx.try_send(cmd).is_err() {
                            // This warning is expected if YOLO is slower than the video FPS.
                        }

                        Ok(gst::FlowSuccess::Ok)
                    })
                    .build(),
            );

            loop {
                match packet_rx.recv().await {
                    Ok(packet) => {
                        let header_bytes = packet.header.marshal().unwrap();
                        let mut raw_packet_bytes =
                            Vec::with_capacity(header_bytes.len() + packet.payload.len());
                        raw_packet_bytes.extend_from_slice(&header_bytes);
                        raw_packet_bytes.extend_from_slice(&packet.payload);

                        let buffer = gst::Buffer::from_slice(raw_packet_bytes);
                        if appsrc.push_buffer(buffer).is_err() {
                            error!("Failed to push buffer to appsrc, pipeline might have closed.");
                            break;
                        }
                    }
                    Err(e) => {
                        warn!("RTP packet receiver lagged or closed: {}", e);
                    }
                }
            }

            let _ = pipeline.set_state(gst::State::Null);
        });

        Ok(handle)
    }
}
