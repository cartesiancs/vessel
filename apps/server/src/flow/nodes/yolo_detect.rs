use anyhow::{anyhow, Result};
use async_trait::async_trait;
use image::{imageops, RgbImage};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs::File;
use std::io::Read;
use tract_ndarray::s;
use tract_onnx::prelude::*;

use super::{ExecutableNode, ExecutionResult};
use crate::flow::engine::ExecutionContext;

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
        Ok(Self {
            data,
            model,
            labels,
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
        let frame_value = inputs
            .get("frame")
            .ok_or_else(|| anyhow!("'frame' input missing"))?;

        let rgb_data_b64 = frame_value
            .get("rgb_data")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("'rgb_data' missing"))?;
        let width = frame_value
            .get("width")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| anyhow!("'width' missing"))? as u32;
        let height = frame_value
            .get("height")
            .and_then(|v| v.as_u64())
            .ok_or_else(|| anyhow!("'height' missing"))? as u32;

        let rgb_data = base64::decode(rgb_data_b64)?;
        let img = RgbImage::from_raw(width, height, rgb_data)
            .ok_or_else(|| anyhow!("Failed to create RgbImage from raw data"))?;

        let input_size = self.data.input_size;
        let resized_img =
            imageops::resize(&img, input_size, input_size, imageops::FilterType::Triangle);

        let tensor: Tensor = tract_ndarray::Array4::from_shape_fn(
            (1, 3, input_size as usize, input_size as usize),
            |(_, c, y, x)| resized_img.get_pixel(x as u32, y as u32)[c] as f32 / 255.0,
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
            let x1 = (xc - w / 2.0) / input_size as f32 * width as f32;
            let y1 = (yc - h / 2.0) / input_size as f32 * height as f32;
            let x2 = (xc + w / 2.0) / input_size as f32 * width as f32;
            let y2 = (yc + h / 2.0) / input_size as f32 * height as f32;
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

        if !detections.is_empty() {
            println!("Detections found: {:?}", detections);
        }

        let mut outputs_map = HashMap::new();
        outputs_map.insert("detections".to_string(), json!(detections));

        Ok(ExecutionResult {
            outputs: outputs_map,
            ..Default::default()
        })
    }
}
