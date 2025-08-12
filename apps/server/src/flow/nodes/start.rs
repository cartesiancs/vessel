use async_trait::async_trait;
use std::collections::HashMap;
use anyhow::Result;
use serde_json::Value;
use super::{ExecutableNode, ExecutionResult, ExecutionContext};

pub struct StartNode;

#[async_trait]
impl ExecutableNode for StartNode {
    async fn execute(&self, _context: &mut ExecutionContext, _inputs: HashMap<String, Value>) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        outputs.insert("out".to_string(), Value::Null);
        Ok(ExecutionResult { outputs })
    }
}