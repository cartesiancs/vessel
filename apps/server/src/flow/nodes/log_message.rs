use async_trait::async_trait;
use std::collections::HashMap;
use anyhow::Result;
use serde_json::Value;
use crate::flow::engine::ExecutionContext;

use super::{ExecutableNode, ExecutionResult};

pub struct LogMessageNode;

#[async_trait]
impl ExecutableNode for LogMessageNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        println!("[LOG]: {:?}", inputs);
        Ok(ExecutionResult::default())
    }
}