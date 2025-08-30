use async_trait::async_trait;
use tokio::sync::{broadcast};
use std::{collections::HashMap};
use anyhow::{anyhow, Result};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::flow::engine::ExecutionContext;

use super::{ExecutableNode, ExecutionResult};


#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct LogicOpetatorNodeData {
    operator: String,
}

pub struct LogicOpetatorNode {
    data: LogicOpetatorNodeData,
}

impl LogicOpetatorNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: LogicOpetatorNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }

    async fn get_input_as_bool(
        &self,
        key: &str,
        inputs: &HashMap<String, Value>,
        broadcast_tx: &broadcast::Sender<String>,
    ) -> Result<bool> {
        let input_val = inputs.get(key).ok_or_else(|| anyhow!("Input '{}' is missing", key))?;
        
        if let Some(b) = input_val.as_bool() {
            return Ok(b);
        }
        if let Some(n) = input_val.as_f64() {
            return Ok(n != 0.0);
        }

        let err = anyhow!("Input '{}' is not a valid boolean or number", key);
        if let Ok(payload_str) = serde_json::to_string(&json!({ "type": "log_message", "payload": err.to_string() })) {
            let _ = broadcast_tx.send(payload_str);
        }
        Err(err)
    }

    async fn get_input_as_f64(
        &self,
        key: &str,
        inputs: &HashMap<String, Value>,
        broadcast_tx: &broadcast::Sender<String>,
    ) -> Result<f64> {
        if let Some(n) = inputs.get(key).and_then(Value::as_f64) {
            return Ok(n);
        }

        let err = anyhow!("Input '{}' is not a valid number for comparison", key);
        if let Ok(payload_str) = serde_json::to_string(&json!({ "type": "log_message", "payload": err.to_string() })) {
            let _ = broadcast_tx.send(payload_str);
        }
        Err(err)
    }
}

#[async_trait]
impl ExecutableNode for LogicOpetatorNode {
    async fn execute(&self, _context: &mut ExecutionContext, inputs: HashMap<String, Value>, broadcast_tx: broadcast::Sender<String>,) -> Result<ExecutionResult> {
        let op = self.data.operator.as_str();

        let result_bool = match op {
            "AND" | "OR" | "XOR" | "NAND" | "NOR" | "XNOR" => {
                let a = self.get_input_as_bool("a", &inputs, &broadcast_tx).await?;
                let b = self.get_input_as_bool("b", &inputs, &broadcast_tx).await?;

                match op {
                    "AND" => a && b,
                    "OR" => a || b,
                    "XOR" => a ^ b,
                    "NAND" => !(a && b),
                    "NOR" => !(a || b),
                    "XNOR" => !(a ^ b),
                    _ => unreachable!(),
                }
            },
            ">" | "<" | "==" | "!=" | ">=" | "<=" => {
                let a = self.get_input_as_f64("a", &inputs, &broadcast_tx).await?;
                let b = self.get_input_as_f64("b", &inputs, &broadcast_tx).await?;

                match op {
                    ">" => a > b,
                    "<" => a < b,
                    "==" => a == b,
                    "!=" => a != b,
                    ">=" => a >= b,
                    "<=" => a <= b,
                    _ => unreachable!(),
                }
            },
            _ => {
                let err = anyhow!("Unsupported operator: {}", op);
                if let Ok(payload_str) = serde_json::to_string(&json!({ "type": "log_message", "payload": err.to_string() })) {
                    let _ = broadcast_tx.send(payload_str);
                }
                return Err(err);
            }
        };

        let mut outputs = HashMap::new();
        outputs.insert("bool".to_string(), Value::from(result_bool));
        Ok(ExecutionResult { outputs, ..Default::default() })
    }
}