use async_trait::async_trait;
use std::collections::HashMap;
use anyhow::Result;
use serde_json::Value;
use super::{ExecutableNode, ExecutionResult};

pub struct LogMessageNode;

#[async_trait]
impl ExecutableNode for LogMessageNode {
    async fn execute(&self, inputs: HashMap<String, Value>) -> Result<ExecutionResult> {
        if let Some(msg) = inputs.get("message") {
            println!("[LOG]: {}", msg);
        }
        Ok(ExecutionResult::default())
    }
}