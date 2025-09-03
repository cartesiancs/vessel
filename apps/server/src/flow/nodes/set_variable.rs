use async_trait::async_trait;
use tokio::sync::{broadcast};
use std::{collections::HashMap};
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
    async fn execute(&self, _context: &mut ExecutionContext, _inputs: HashMap<String, Value>, broadcast_tx: broadcast::Sender<String>,) -> Result<ExecutionResult> {
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
                        if broadcast_tx.send(payload_str).is_err() {
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
                            if broadcast_tx.send(payload_str).is_err() {
                                error!("Failed to send websocket log message.");
                            }
                        }
                        return Err(anyhow!(error_message));
                    }
                }
            },
            Some("string") => {
                json!(self.data.variable)
            },
            Some("json") | _ => {
                match serde_json::from_str::<Value>(&self.data.variable) {
                    Ok(json_value) => json_value,
                    Err(_) => {
                        let error_message = format!("Failed to parse '{}' as JSON.", self.data.variable);
                        let ws_message = json!({
                            "type": "log_message",
                            "payload": error_message.clone(),
                        });
                        if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                            if broadcast_tx.send(payload_str).is_err() {
                                error!("Failed to send websocket log message.");
                            }
                        }
                        return Err(anyhow!(error_message));
                    }
                }
            }
        };

        outputs.insert("out".to_string(), value);

        Ok(ExecutionResult { outputs, ..Default::default()  })
    }
}