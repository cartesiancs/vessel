use anyhow::{anyhow, Result};
use async_trait::async_trait;
use rumqttc::QoS;
use serde::Deserialize;
use serde_json::{json, to_string, Value};
use std::collections::HashMap;
use tokio::sync::broadcast;
use tracing::{error, warn};

use super::ExecutableNode;
use crate::flow::{engine::ExecutionContext, types::ExecutionResult};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct MqttPublishNodeData {
    topic: String,
    qos: Option<u8>,
    retain: Option<bool>,
}

pub struct MqttPublishNode {
    data: MqttPublishNodeData,
}

impl MqttPublishNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: MqttPublishNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for MqttPublishNode {
    async fn execute(
        &self,
        context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let Some(payload) = inputs.get("payload") else {
            return Err(anyhow!("'payload' input is missing for MQTT_PUBLISH node"));
        };

        let payload_bytes = match payload {
            Value::String(s) => s.clone().into_bytes(),
            _ => to_string(payload)?.into_bytes(),
        };

        let qos = match self.data.qos.unwrap_or(1) {
            0 => QoS::AtMostOnce,
            1 => QoS::AtLeastOnce,
            2 => QoS::ExactlyOnce,
            _ => return Err(anyhow!("Invalid QoS value. Must be 0, 1, or 2.")),
        };

        let retain = self.data.retain.unwrap_or(false);

        if let Some(client) = context.mqtt_client() {
            match client
                .publish(&self.data.topic, qos, retain, payload_bytes)
                .await
            {
                Ok(_) => (),
                Err(e) => return Err(anyhow!("Failed to publish MQTT message: {}", e)),
            }
        } else {
            warn!("MQTT client is not available, cannot publish message.");
        }

        let ws_message = json!({
            "type": "log_message",
            "payload": "Publish MQTT Topic"
        });
        if let Ok(payload_str) = serde_json::to_string(&ws_message) {
            if context.get_broadcast().send(payload_str).is_err() {
                error!("Failed to send health check response.");
            }
        }

        Ok(ExecutionResult::default())
    }
}
