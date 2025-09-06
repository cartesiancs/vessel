use anyhow::{anyhow, Result};
use async_trait::async_trait;
use ffmpeg_next as ffmpeg;
use image::RgbImage;
use lazy_static::lazy_static;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use std::sync::{Mutex, Once};
use tract_ndarray::s;
use tract_onnx::prelude::*;

use super::{ExecutableNode, ExecutionResult};
use crate::flow::engine::ExecutionContext;

static FFMPEG_INIT: Once = Once::new();

lazy_static! {
    static ref FFMPEG_INITIALIZER: () = {
        FFMPEG_INIT.call_once(|| {
            ffmpeg::init().expect("Failed to initialize FFmpeg");
        });
    };
}

type Model = TypedRunnableModel<Graph<TypedFact, Box<dyn TypedOp>>>;

#[derive(Deserialize, Debug, Clone)]
struct YoloDetectData {
    model_path: String,
    labels_path: String,
    confidence_threshold: f32,
    nms_threshold: f32,
    input_size: u32,
}

#[derive(Debug, Clone)]
struct BBox {
    x1: f32,
    y1: f32,
    x2: f32,
    y2: f32,
    confidence: f32,
    class_id: usize,
}

pub struct YoloDetectNode {
    data: YoloDetectData,
    model: Model,
    labels: Vec<String>,
    ffmpeg_decoder: Mutex<ffmpeg::decoder::Video>,
}

fn nms(boxes: &mut Vec<BBox>, threshold: f32) {
    if boxes.is_empty() {
        return;
    }
    boxes.sort_by(|a, b| b.confidence.partial_cmp(&a.confidence).unwrap());
    let mut i = 0;
    while i < boxes.len() {
        let mut j = i + 1;
        while j < boxes.len() {
            let area_i = (boxes[i].x2 - boxes[i].x1) * (boxes[i].y2 - boxes[i].y1);
            let area_j = (boxes[j].x2 - boxes[j].x1) * (boxes[j].y2 - boxes[j].y1);
            let inter_x1 = boxes[i].x1.max(boxes[j].x1);
            let inter_y1 = boxes[i].y1.max(boxes[j].y1);
            let inter_x2 = boxes[i].x2.min(boxes[j].x2);
            let inter_y2 = boxes[i].y2.min(boxes[j].y2);
            let inter_w = (inter_x2 - inter_x1).max(0.0);
            let inter_h = (inter_y2 - inter_y1).max(0.0);
            let intersection = inter_w * inter_h;
            let union = area_i + area_j - intersection;
            let iou = intersection / union;

            if iou > threshold {
                boxes.remove(j);
            } else {
                j += 1;
            }
        }
        i += 1;
    }
}

impl YoloDetectNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let _ = *FFMPEG_INITIALIZER;
        let data: YoloDetectData = serde_json::from_value(node_data.clone())?;

        let model_input_size = data.input_size as i64;

        let model = tract_onnx::onnx()
            .model_for_path(&data.model_path)?
            .with_input_fact(
                0,
                InferenceFact::dt_shape(
                    f32::datum_type(),
                    tvec!(1, 3, model_input_size, model_input_size),
                ),
            )?
            .into_optimized()?
            .into_runnable()?;

        let mut labels_file = File::open(&data.labels_path)?;
        let mut labels_content = String::new();
        labels_file.read_to_string(&mut labels_content)?;
        let labels: Vec<String> = labels_content.lines().map(String::from).collect();

        let codec = ffmpeg::decoder::find(ffmpeg::codec::Id::H264)
            .ok_or_else(|| anyhow!("H.264 decoder not found"))?;
        let context = ffmpeg::codec::Context::new_with_codec(codec);
        let decoder = context.decoder().video()?;

        Ok(Self {
            data,
            model,
            labels,
            ffmpeg_decoder: Mutex::new(decoder),
        })
    }
}

#[async_trait]
impl ExecutableNode for YoloDetectNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let frame_base64 = inputs
            .get("frame")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("'frame' input missing or not a string"))?;

        let frame_data = base64::decode(frame_base64)?;

        let mut decoder = self.ffmpeg_decoder.lock().unwrap();
        let packet = ffmpeg::Packet::copy(&frame_data);
        decoder.send_packet(&packet)?;

        let mut decoded_frame = ffmpeg::frame::Video::empty();
        if decoder.receive_frame(&mut decoded_frame).is_err() {
            return Ok(ExecutionResult::default());
        }

        let original_width = decoded_frame.width();
        let original_height = decoded_frame.height();
        let input_size = self.data.input_size;

        let mut rgb_frame = ffmpeg::frame::Video::empty();
        let mut scaler = ffmpeg::software::scaling::context::Context::get(
            decoded_frame.format(),
            decoded_frame.width(),
            decoded_frame.height(),
            ffmpeg::format::Pixel::RGB24,
            input_size,
            input_size,
            ffmpeg::software::scaling::flag::Flags::BILINEAR,
        )?;
        scaler.run(&decoded_frame, &mut rgb_frame)?;

        let img = RgbImage::from_raw(input_size, input_size, rgb_frame.data(0).to_vec())
            .ok_or_else(|| anyhow!("Failed to create RgbImage from ffmpeg frame"))?;

        let tensor: Tensor = tract_ndarray::Array4::from_shape_fn(
            (1, 3, input_size as usize, input_size as usize),
            |(_, c, y, x)| img.get_pixel(x as u32, y as u32)[c] as f32 / 255.0,
        )
        .into();

        let result = self.model.run(tvec!(tensor.into()))?;
        let output = result[0].to_array_view::<f32>()?;

        let mut bboxes = Vec::new();
        let outputs = output.slice(s![0, .., ..]).permuted_axes([1, 0]);

        for row in outputs.rows() {
            let (class_id, confidence) = row.slice(s![4..]).iter().enumerate().fold(
                (0, 0.0),
                |(idx_max, val_max), (idx, &val)| {
                    if val > val_max {
                        (idx, val)
                    } else {
                        (idx_max, val_max)
                    }
                },
            );

            if confidence < self.data.confidence_threshold {
                continue;
            }

            let xc = row[0];
            let yc = row[1];
            let w = row[2];
            let h = row[3];

            let x1 = (xc - w / 2.0) / input_size as f32 * original_width as f32;
            let y1 = (yc - h / 2.0) / input_size as f32 * original_height as f32;
            let x2 = (xc + w / 2.0) / input_size as f32 * original_width as f32;
            let y2 = (yc + h / 2.0) / input_size as f32 * original_height as f32;

            bboxes.push(BBox {
                x1,
                y1,
                x2,
                y2,
                confidence,
                class_id,
            });
        }

        nms(&mut bboxes, self.data.nms_threshold);

        let detections: Vec<Value> = bboxes
            .into_iter()
            .map(|b| {
                json!({
                    "class": self.labels.get(b.class_id).map_or("unknown", |s| s.as_str()),
                    "confidence": b.confidence,
                    "box": { "x1": b.x1, "y1": b.y1, "x2": b.x2, "y2": b.y2 }
                })
            })
            .collect();

        let mut outputs_map = HashMap::new();
        outputs_map.insert("detections".to_string(), json!(detections));

        Ok(ExecutionResult {
            outputs: outputs_map,
            ..Default::default()
        })
    }
}
