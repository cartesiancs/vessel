use anyhow::Result;
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use tokio::{
    sync::{broadcast, mpsc},
    task::JoinHandle,
};
use tracing::warn;

use super::{ExecutableNode, ExecutionResult};
use crate::flow::engine::{ExecutionContext, TriggerCommand};
use crate::state::MqttMessage;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MqttSubscribeNodeData {
    pub topic: String,
}

pub struct MqttSubscribeNode {
    pub data: MqttSubscribeNodeData,
    mqtt_rx: broadcast::Receiver<MqttMessage>,
    source_node_ids: Vec<String>,
}

impl MqttSubscribeNode {
    pub fn new(
        node_data: &Value,
        mqtt_rx: broadcast::Receiver<MqttMessage>,
        source_node_ids: Vec<String>,
    ) -> Result<Self> {
        let data: MqttSubscribeNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self {
            data,
            mqtt_rx,
            source_node_ids,
        })
    }
}

#[async_trait]
impl ExecutableNode for MqttSubscribeNode {
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
        let mut rx = self.mqtt_rx.resubscribe();
        let topic_to_match = self.data.topic.clone();
        let source_ids = self.source_node_ids.clone();

        let handle = tokio::spawn(async move {
            loop {
                match rx.recv().await {
                    Ok(msg) => {
                        if msg.topic == topic_to_match {
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

                            let payload_value = match serde_json::from_slice(&msg.bytes) {
                                Ok(p) => p,
                                Err(_) => {
                                    Value::String(String::from_utf8_lossy(&msg.bytes).to_string())
                                }
                            };
                            let mut inputs = HashMap::new();
                            inputs.insert("payload".to_string(), payload_value);

                            let cmd = TriggerCommand {
                                node_id: node_id.clone(),
                                inputs,
                            };

                            if trigger_tx.send(cmd).await.is_err() {
                                break;
                            }
                        }
                    }
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {
                        warn!("MQTT trigger lagged. Some messages may have been missed.");
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
