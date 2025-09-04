use crate::flow::engine::ExecutionContext;
use anyhow::Result;
use async_trait::async_trait;
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::sync::broadcast;
use tracing::error;

use super::{ExecutableNode, ExecutionResult};

pub struct LogMessageNode;

#[async_trait]
impl ExecutableNode for LogMessageNode {
    async fn execute(
        &self,
        context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        println!("[LOG]: {:?}", inputs);

        let ws_message = json!({
            "type": "log_message",
            "payload": inputs.clone()
        });
        if let Ok(payload_str) = serde_json::to_string(&ws_message) {
            if context.get_broadcast().send(payload_str).is_err() {
                error!("Failed to send health check response.");
            }
        }
        Ok(ExecutionResult::default())
    }
}
