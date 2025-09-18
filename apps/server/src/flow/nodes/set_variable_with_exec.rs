use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::sync::broadcast;
use tracing::log::error;

use super::{ExecutableNode, ExecutionContext, ExecutionResult};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct SetVariableNodeData {
    variable: String,
    variable_type: Option<String>,
}

pub struct SetVariableWithExecNode {
    data: SetVariableNodeData,
}

impl SetVariableWithExecNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: SetVariableNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for SetVariableWithExecNode {
    async fn execute(
        &self,
        context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let Some(execution) = inputs.get("exec") else {
            if let Ok(payload_str) = serde_json::to_string(&json!({
                "type": "log_message",
                "payload": "'execution' input is missing for WEBSOCKET_SEND node"
            })) {
                if context.get_broadcast().send(payload_str).is_err() {
                    error!("Failed to send health check response.");
                }
            }

            return Err(anyhow!("'exec' input is missing for WEBSOCKET_SEND node"));
        };

        let mut outputs = HashMap::new();

        let value = match self.data.variable_type.as_deref() {
            Some("number") => {
                if let Ok(num) = self.data.variable.parse::<i64>() {
                    json!(num)
                } else if let Ok(num) = self.data.variable.parse::<f64>() {
                    json!(num)
                } else {
                    let error_message =
                        format!("Failed to parse '{}' as a number.", self.data.variable);
                    let ws_message = json!({
                        "type": "log_message",
                        "payload": error_message.clone()
                    });
                    if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                        if context.get_broadcast().send(payload_str).is_err() {
                            error!("Failed to send websocket log message.");
                        }
                    }

                    return Err(anyhow!(error_message));
                }
            }
            Some("boolean") => match self.data.variable.parse::<bool>() {
                Ok(b) => json!(b),
                Err(_) => {
                    let error_message =
                        format!("Failed to parse '{}' as a boolean.", self.data.variable);
                    let ws_message = json!({
                        "type": "log_message",
                        "payload": error_message.clone(),
                    });
                    if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                        if context.get_broadcast().send(payload_str).is_err() {
                            error!("Failed to send websocket log message.");
                        }
                    }
                    return Err(anyhow!(error_message));
                }
            },
            Some("string") => {
                json!(self.data.variable)
            }
            Some("json") | _ => match serde_json::from_str::<Value>(&self.data.variable) {
                Ok(json_value) => json_value,
                Err(_) => {
                    let error_message =
                        format!("Failed to parse '{}' as JSON.", self.data.variable);
                    let ws_message = json!({
                        "type": "log_message",
                        "payload": error_message.clone(),
                    });
                    if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                        if context.get_broadcast().send(payload_str).is_err() {
                            error!("Failed to send websocket log message.");
                        }
                    }
                    return Err(anyhow!(error_message));
                }
            },
        };

        outputs.insert("out".to_string(), value);

        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }
}
