use async_trait::async_trait;
use axum::extract::ws::{Message, WebSocket};
use futures_util::{stream::SplitSink, SinkExt};
use tokio::sync::{broadcast, Mutex};
use std::{collections::HashMap, sync::Arc};
use anyhow::Result;
use serde_json::{json, Value};
use crate::flow::engine::ExecutionContext;
use tracing::{error, info, warn};

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