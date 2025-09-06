use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::Mutex;

use super::{ExecutableNode, ExecutionResult};
use crate::flow::engine::ExecutionContext;

const RTP_HEADER_MIN_SIZE: usize = 12;

pub struct DecodeH264Node {
    buffer: Mutex<Vec<u8>>,
}

impl DecodeH264Node {
    pub fn new() -> Result<Self> {
        Ok(Self {
            buffer: Mutex::new(Vec::new()),
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

        let packet_data = base64::decode(encoded_packet)?;

        if packet_data.len() < RTP_HEADER_MIN_SIZE {
            return Err(anyhow!("RTP packet is too short"));
        }

        let byte0 = packet_data[0];
        let byte1 = packet_data[1];

        let marker = (byte1 & 0b1000_0000) != 0;
        let csrc_count = (byte0 & 0b0000_1111) as usize;

        let mut payload_offset = RTP_HEADER_MIN_SIZE + csrc_count * 4;

        let has_extension = (byte0 & 0b0001_0000) != 0;
        if has_extension {
            if packet_data.len() < payload_offset + 4 {
                return Err(anyhow!(
                    "RTP packet is too short to contain extension header"
                ));
            }
            let extension_len_start = payload_offset + 2;
            let extension_len_words = u16::from_be_bytes([
                packet_data[extension_len_start],
                packet_data[extension_len_start + 1],
            ]) as usize;
            let extension_len_bytes = extension_len_words * 4;
            payload_offset += 4 + extension_len_bytes;
        }

        if packet_data.len() < payload_offset {
            return Err(anyhow!("RTP packet payload offset is out of bounds"));
        }

        let payload = &packet_data[payload_offset..];

        let mut buffer = self.buffer.lock().unwrap();
        buffer.extend_from_slice(payload);

        if marker {
            if !buffer.is_empty() {
                let frame_data = buffer.clone();
                buffer.clear();
                drop(buffer);

                let frame_base64 = base64::encode(&frame_data);
                let mut outputs = HashMap::new();
                outputs.insert("frame".to_string(), json!(frame_base64));
                Ok(ExecutionResult {
                    outputs,
                    ..Default::default()
                })
            } else {
                Ok(ExecutionResult::default())
            }
        } else {
            Ok(ExecutionResult::default())
        }
    }
}
