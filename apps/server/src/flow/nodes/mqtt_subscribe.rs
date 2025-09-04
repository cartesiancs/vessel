use anyhow::Result;
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use tokio::{
    sync::{broadcast, mpsc},
    task::JoinHandle,
    time,
};

use super::{ExecutableNode, ExecutionResult};
use crate::{
    flow::engine::{ExecutionContext, TriggerCommand},
    state::MqttMessage,
};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MqttSubscribeNodeData {
    pub topic: String,
}

pub struct MqttSubscribeNode {
    pub data: MqttSubscribeNodeData,
    mqtt_rx: broadcast::Receiver<MqttMessage>,
}

impl MqttSubscribeNode {
    pub fn new(node_data: &Value, mqtt_rx: broadcast::Receiver<MqttMessage>) -> Result<Self> {
        let data: MqttSubscribeNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data, mqtt_rx })
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

        let handle = tokio::spawn(async move {
            while let Ok(msg) = rx.recv().await {
                if msg.topic == topic_to_match {
                    let payload_value = match serde_json::from_slice(&msg.bytes) {
                        Ok(p) => p,
                        Err(_) => Value::String(String::from_utf8_lossy(&msg.bytes).to_string()),
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
        });
        Ok(handle)
    }
}
