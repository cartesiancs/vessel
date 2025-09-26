use crate::flow::engine::ExecutionContext;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;

use super::{ExecutableNode, ExecutionResult};

#[derive(Deserialize, Debug)]
struct JsonModifyData {
    path: String,
}

pub struct JsonModifyNode {
    data: JsonModifyData,
}

impl JsonModifyNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: JsonModifyData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for JsonModifyNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let mut json_input = inputs
            .get("json")
            .cloned()
            .ok_or_else(|| anyhow!("'json' input is missing for JSON_Modify node"))?;

        let data_input = inputs
            .get("data")
            .cloned()
            .ok_or_else(|| anyhow!("'data' input is missing for JSON_Set node"))?;

        let json_pointer_path = format!("/{}", self.data.path.replace('.', "/"));

        let target = json_input
            .pointer_mut(&json_pointer_path)
            .ok_or_else(|| anyhow!("Path '{}' not found in the input json", self.data.path))?;

        *target = data_input;

        let mut outputs = HashMap::new();
        outputs.insert("value".to_string(), json_input);

        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }
}
