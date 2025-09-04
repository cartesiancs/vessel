use crate::flow::engine::ExecutionContext;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

use super::{ExecutableNode, ExecutionResult};

#[derive(Deserialize, Debug)]
struct JsonSelectorData {
    path: String,
}

pub struct JsonSelectorNode {
    data: JsonSelectorData,
}

impl JsonSelectorNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: JsonSelectorData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for JsonSelectorNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let json_input = inputs
            .get("json")
            .ok_or_else(|| anyhow!("'json' input is missing for JSON_SELECTOR node"))?;

        let json_pointer_path = format!("/{}", self.data.path.replace('.', "/"));

        let selected_value = json_input
            .pointer(&json_pointer_path)
            .cloned()
            .unwrap_or(Value::Null);

        let mut outputs = HashMap::new();
        outputs.insert("value".to_string(), selected_value);

        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }
}
