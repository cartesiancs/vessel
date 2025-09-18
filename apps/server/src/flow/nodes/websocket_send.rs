use anyhow::{anyhow, Result};
use async_trait::async_trait;
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::{json, to_string, Value};
use std::collections::HashMap;
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};
use tracing::{error, info};

use super::ExecutableNode;
use crate::flow::{engine::ExecutionContext, types::ExecutionResult};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct WebSocketSendNodeData {
    url: String,
}

pub struct WebSocketSendNode {
    data: WebSocketSendNodeData,
}

impl WebSocketSendNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: WebSocketSendNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for WebSocketSendNode {
    async fn execute(
        &self,
        context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let url_str = &self.data.url;

        let Some(payload) = inputs.get("payload") else {
            if let Ok(payload_str) = serde_json::to_string(&json!({
                "type": "log_message",
                "payload": "'payload' input is missing for WEBSOCKET_SEND node"
            })) {
                if context.get_broadcast().send(payload_str).is_err() {
                    error!("Failed to send health check response.");
                }
            }

            return Err(anyhow!(
                "'payload' input is missing for WEBSOCKET_SEND node"
            ));
        };

        let payload_str = match payload {
            Value::String(s) => s.clone(),
            _ => to_string(payload)?,
        };

        info!("Connecting to WebSocket at {} to send message", url_str);
        let (ws_stream, _) = connect_async(url_str)
            .await
            .map_err(|e| anyhow!("Failed to connect to WebSocket: {}", e))?;

        let (mut write, _) = ws_stream.split();

        info!("Sending message to WebSocket");
        write
            .send(Message::Text(payload_str.into()))
            .await
            .map_err(|e| anyhow!("Failed to send message via WebSocket: {}", e))?;

        info!("Message sent, closing WebSocket connection.");
        write
            .close()
            .await
            .map_err(|e| anyhow!("Failed to close WebSocket connection: {}", e))?;

        Ok(ExecutionResult::default())
    }
}
