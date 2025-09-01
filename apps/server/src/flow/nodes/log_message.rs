use async_trait::async_trait;
use tokio::sync::{broadcast};
use std::{collections::HashMap};
use anyhow::Result;
use serde_json::{json, Value};
use crate::flow::engine::ExecutionContext;
use tracing::{error};

use super::{ExecutableNode, ExecutionResult};

pub struct LogMessageNode;

#[async_trait]
impl ExecutableNode for LogMessageNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
        broadcast_tx: broadcast::Sender<String>,
    ) -> Result<ExecutionResult> {
        println!("[LOG]: {:?}", inputs);

        let ws_message = json!({
            "type": "log_message",
            "payload": inputs.clone()
        });
        if let Ok(payload_str) = serde_json::to_string(&ws_message) {
            if broadcast_tx.send(payload_str).is_err() {
                error!("Failed to send health check response.");
            }
        }
        Ok(ExecutionResult::default())
    }
}