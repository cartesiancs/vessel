use crate::flow::engine::ExecutionContext;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;

use super::{ExecutableNode, ExecutionResult};

pub struct BranchNode;

impl BranchNode {
    pub fn new() -> Result<Self> {
        Ok(Self)
    }
}

#[async_trait]
impl ExecutableNode for BranchNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let data = inputs
            .get("data")
            .ok_or_else(|| anyhow!("'data' input is missing for BRANCH node"))?;

        let condition = inputs
            .get("condition")
            .and_then(|v| v.as_bool())
            .ok_or_else(|| anyhow!("'condition' input must be a boolean for BRANCH node"))?;

        let mut outputs = HashMap::new();

        if condition {
            outputs.insert("true_output".to_string(), data.clone());
        } else {
            outputs.insert("false_output".to_string(), data.clone());
        }

        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }
}
