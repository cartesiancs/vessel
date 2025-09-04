use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::sync::broadcast;

use crate::flow::{engine::ExecutionContext, types::Trigger};

use super::{ExecutableNode, ExecutionResult};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct LoopNodeData {
    iterations: u64,
}

pub struct LoopNode {
    data: LoopNodeData,
}

impl LoopNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: LoopNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for LoopNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let mut result = ExecutionResult::default();

        let body_node_id = inputs
            .get("body_node_id")
            .and_then(Value::as_str)
            .map(String::from)
            .ok_or_else(|| anyhow!("LoopNode requires 'body_node_id' which should be automatically injected by the engine."))?;

        let body_input_name = inputs
            .get("body_input_name")
            .and_then(Value::as_str)
            .map(String::from)
            .ok_or_else(|| anyhow!("LoopNode requires 'body_input_name' which should be automatically injected by the engine."))?;

        for i in 0..self.data.iterations {
            let mut inputs_for_body = HashMap::new();
            inputs_for_body.insert(body_input_name.clone(), json!(i));

            result.triggers.push(Trigger {
                node_id: body_node_id.clone(),
                inputs: inputs_for_body,
            });
        }

        Ok(result)
    }
}
