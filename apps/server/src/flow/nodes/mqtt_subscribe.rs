use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use anyhow::Result;
use tokio::sync::broadcast;
use std::collections::HashMap;

use crate::flow::engine::ExecutionContext;
use super::{ExecutableNode, ExecutionResult};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MqttSubscribeNodeData {
    pub topic: String,
}

pub struct MqttSubscribeNode {
    pub data: MqttSubscribeNodeData,
}

impl MqttSubscribeNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: MqttSubscribeNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for MqttSubscribeNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
        broadcast_tx: broadcast::Sender<String>,
    ) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        if let Some(payload) = inputs.get("payload") {
            outputs.insert("payload".to_string(), payload.clone());
        }
        Ok(ExecutionResult { outputs, ..Default::default() })
    }
}