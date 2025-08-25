use async_trait::async_trait;
use axum::extract::ws::{Message, WebSocket};
use futures_util::{stream::SplitSink, SinkExt};
use tokio::sync::Mutex;
use std::{collections::HashMap, sync::Arc};
use anyhow::{Result, anyhow};
use serde::Deserialize;
use serde_json::{Value, json};
use tracing::log::error;

use super::{ExecutableNode, ExecutionResult, ExecutionContext};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct SetVariableNodeData {
    variable: String,
    variable_type: Option<String>,
}

pub struct SetVariableNode {
    data: SetVariableNodeData,
}

impl SetVariableNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: SetVariableNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for SetVariableNode {
    async fn execute(&self, _context: &mut ExecutionContext, inputs: HashMap<String, Value>, ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();

        let value = match self.data.variable_type.as_deref() {
            Some("number") => {
                if let Ok(num) = self.data.variable.parse::<i64>() {
                    json!(num)
                } else if let Ok(num) = self.data.variable.parse::<f64>() {
                    json!(num)
                } else {
                    let error_message = format!("Failed to parse '{}' as a number.", self.data.variable);
                    let ws_message = json!({
                        "type": "log_message",
                        "payload": error_message.clone()
                    });
                    if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                        if ws_sender.lock().await.send(Message::Text(payload_str)).await.is_err() {
                            error!("Failed to send websocket log message.");
                        }
                    }
                    
                    return Err(anyhow!(error_message));
                }
            },
            Some("boolean") => {
                match self.data.variable.parse::<bool>() {
                    Ok(b) => json!(b),
                    Err(_) => {
                        let error_message = format!("Failed to parse '{}' as a boolean.", self.data.variable);
                        let ws_message = json!({
                            "type": "log_message",
                            "payload": error_message.clone(),
                        });
                        if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                            if ws_sender.lock().await.send(Message::Text(payload_str)).await.is_err() {
                                error!("Failed to send websocket log message.");
                            }
                        }
                        return Err(anyhow!(error_message));
                    }
                }
            },
            Some("string") | _ => {
                json!(self.data.variable)
            }
        };

        outputs.insert("out".to_string(), value);

        Ok(ExecutionResult { outputs, ..Default::default()  })
    }
}