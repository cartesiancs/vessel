use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::{sync::mpsc, task::JoinHandle};

use super::{ExecutableNode, ExecutionResult};
use crate::{
    flow::engine::{ExecutionContext, TriggerCommand},
    state::StreamManager,
};

#[derive(Deserialize, Debug, Clone)]
pub struct RtpStreamInData {
    topic: String,
}

pub struct RtpStreamInNode {
    data: RtpStreamInData,
    stream_manager: StreamManager,
}

impl RtpStreamInNode {
    pub fn new(node_data: &Value, stream_manager: StreamManager) -> Result<Self> {
        let data: RtpStreamInData = serde_json::from_value(node_data.clone())?;
        Ok(Self {
            data,
            stream_manager,
        })
    }
}

#[async_trait]
impl ExecutableNode for RtpStreamInNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        if let Some(payload) = inputs.get("payload") {
            outputs.insert("payload".to_string(), payload.clone());
        }
        Ok(ExecutionResult {
            outputs,
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
        let stream_info = self
            .stream_manager
            .iter()
            .find(|entry| entry.value().topic == self.data.topic)
            .map(|entry| entry.value().clone())
            .ok_or_else(|| anyhow!("Stream with topic '{}' not found", self.data.topic))?;

        let mut packet_rx = stream_info.packet_tx.subscribe();

        let handle = tokio::spawn(async move {
            while let Ok(packet) = packet_rx.recv().await {
                let payload_base64 = base64::encode(&packet.payload);
                let mut inputs = HashMap::new();
                inputs.insert("payload".to_string(), json!(payload_base64));

                let cmd = TriggerCommand {
                    node_id: node_id.clone(),
                    inputs,
                };

                if trigger_tx.send(cmd).await.is_err() {
                    break;
                }
            }
        });
        Ok(handle)
    }
}
