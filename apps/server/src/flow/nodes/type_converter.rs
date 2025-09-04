use super::{ExecutableNode, ExecutionResult};
use crate::flow::engine::ExecutionContext;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{Number, Value};
use std::collections::HashMap;
use tokio::sync::broadcast;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct TypeConverterNodeData {
    target_type: String,
}

pub struct TypeConverterNode {
    data: TypeConverterNodeData,
}

impl TypeConverterNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: TypeConverterNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for TypeConverterNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let input_value = inputs
            .get("in")
            .ok_or_else(|| anyhow!("'in' input is missing for TypeConverterNode"))?;

        let converted_value = match self.data.target_type.as_str() {
            "string" => {
                let s = match input_value {
                    Value::String(s) => s.clone(),
                    Value::Number(n) => n.to_string(),
                    Value::Bool(b) => b.to_string(),
                    Value::Null => "null".to_string(),
                    _ => serde_json::to_string(input_value)?,
                };
                Value::String(s.replace('\"', ""))
            }
            "number" => {
                let num = match input_value {
                    Value::Number(n) => n.as_f64().unwrap_or(0.0),
                    Value::String(s) => s
                        .parse::<f64>()
                        .map_err(|_| anyhow!("Failed to parse string '{}' to number", s))?,
                    Value::Bool(b) => {
                        if *b {
                            1.0
                        } else {
                            0.0
                        }
                    }
                    _ => return Err(anyhow!("Cannot convert type to a number")),
                };
                Value::Number(
                    Number::from_f64(num)
                        .ok_or_else(|| anyhow!("Invalid f64 value for conversion"))?,
                )
            }
            "boolean" => {
                let b = match input_value {
                    Value::Bool(b) => *b,
                    Value::String(s) => s.to_lowercase() == "true",
                    Value::Number(n) => n.as_f64().unwrap_or(0.0) != 0.0,
                    _ => false,
                };
                Value::Bool(b)
            }
            _ => {
                return Err(anyhow!(
                    "Unsupported target type: {}",
                    self.data.target_type
                ))
            }
        };

        let mut outputs = HashMap::new();
        outputs.insert("out".to_string(), converted_value);
        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }
}
