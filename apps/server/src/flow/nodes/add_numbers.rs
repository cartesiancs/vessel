use async_trait::async_trait;
use tokio::sync::{broadcast};
use std::{collections::HashMap,};
use anyhow::{Result, anyhow};
use tracing::log::error;
use serde_json::{Value, json};
use crate::flow::engine::ExecutionContext;

use super::{ExecutableNode, ExecutionResult};

pub struct AddNumbersNode;

#[async_trait]
impl ExecutableNode for AddNumbersNode {
    async fn execute(&self, _context: &mut ExecutionContext, inputs: HashMap<String, Value>, broadcast_tx: broadcast::Sender<String>,) -> Result<ExecutionResult> {
        let a = match inputs.get("a").and_then(Value::as_f64) {
            Some(num) => num,
            None => {
                let error_message = "Input 'a' is missing or not a valid number.".to_string();
                let ws_message = json!({
                    "type": "log_message",
                    "payload": {
                        "error": error_message.clone(),
                        "inputs": inputs.clone()
                    }
                });
                if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                    if broadcast_tx.send(payload_str).is_err() {
                        error!("Failed to send websocket log message.");
                    }
                }
                return Err(anyhow!(error_message));
            }
        };

        let b = match inputs.get("b").and_then(Value::as_f64) {
            Some(num) => num,
            None => {
                let error_message = "Input 'b' is missing or not a valid number.".to_string();
                let ws_message = json!({
                    "type": "log_message",
                    "payload": {
                        "error": error_message.clone(),
                        "inputs": inputs.clone()
                    }
                });
                if let Ok(payload_str) = serde_json::to_string(&ws_message) {
                    if broadcast_tx.send(payload_str).is_err() {
                        error!("Failed to send websocket log message.");
                    }
                }
                return Err(anyhow!(error_message));
            }
        };

        let result = a + b;
        let mut outputs = HashMap::new();
        outputs.insert("number".to_string(), Value::from(result));

        Ok(ExecutionResult { outputs, ..Default::default()  })
    }
}