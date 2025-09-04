use anyhow::{anyhow, Result};
use async_trait::async_trait;
use opus;
use serde_json::{json, Value};
use std::collections::HashMap;

use super::{ExecutableNode, ExecutionResult};
use crate::flow::engine::ExecutionContext;

pub struct DecodeOpusNode;

impl DecodeOpusNode {
    pub fn new() -> Result<Self> {
        Ok(Self)
    }
}

#[async_trait]
impl ExecutableNode for DecodeOpusNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let encoded_payload = inputs
            .get("payload")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("'payload' input missing or not a string"))?;

        let opus_data = base64::decode(encoded_payload)?;

        let mut decoder =
            opus::Decoder::new(48000, opus::Channels::Mono).map_err(|e| anyhow!(e))?;

        let mut pcm_output = vec![0i16; 5760];
        let decoded_samples = decoder.decode(&opus_data, &mut pcm_output, false)?;
        let pcm_slice = &pcm_output[..decoded_samples];

        let audio_info = if pcm_slice.is_empty() {
            json!({
                "decibels": -120.0,
                "duration_ms": 0,
                "sample_rate": 48000,
                "channels": 1
            })
        } else {
            let pcm_bytes: Vec<u8> = pcm_slice
                .iter()
                .flat_map(|&sample| sample.to_le_bytes())
                .collect();
            let pcm_payload_base64 = base64::encode(&pcm_bytes);

            let sum_of_squares = pcm_slice.iter().map(|&s| (s as f64).powi(2)).sum::<f64>();
            let rms = (sum_of_squares / pcm_slice.len() as f64).sqrt();

            let dbfs = if rms > 0.0 {
                20.0 * rms.log10() - 20.0 * (i16::MAX as f64).log10()
            } else {
                -120.0
            };

            let duration_ms = (pcm_slice.len() as f64 * 1000.0) / 48000.0;

            json!({
                "decibels": dbfs,
                "duration_ms": duration_ms,
                "sample_rate": 48000,
                "channels": 1
            })
        };

        let mut outputs = HashMap::new();
        outputs.insert("info".to_string(), audio_info);

        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }
}
