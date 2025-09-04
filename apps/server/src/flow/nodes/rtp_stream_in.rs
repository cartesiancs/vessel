use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::{sync::mpsc, task::JoinHandle};
use tracing::warn;

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
    source_node_ids: Vec<String>,
}

impl RtpStreamInNode {
    pub fn new(
        node_data: &Value,
        stream_manager: StreamManager,
        source_node_ids: Vec<String>,
    ) -> Result<Self> {
        let data: RtpStreamInData = serde_json::from_value(node_data.clone())?;
        Ok(Self {
            data,
            stream_manager,
            source_node_ids,
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
        let source_ids = self.source_node_ids.clone();

        let handle = tokio::spawn(async move {
            loop {
                match packet_rx.recv().await {
                    Ok(packet) => {
                        for source_id in &source_ids {
                            if *source_id != node_id {
                                let cmd = TriggerCommand {
                                    node_id: source_id.clone(),
                                    inputs: HashMap::new(),
                                };
                                if trigger_tx.send(cmd).await.is_err() {
                                    return;
                                }
                            }
                        }

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
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                        warn!("RTP trigger lagged. Some packets may have been missed.");
                        continue;
                    }
                    Err(_) => {
                        break;
                    }
                }
            }
        });
        Ok(handle)
    }
}
