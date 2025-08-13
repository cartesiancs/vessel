use async_trait::async_trait;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use tokio::sync::Mutex;
use std::{collections::HashMap, sync::Arc};
use anyhow::{Result, anyhow};
use serde::Deserialize;
use serde_json::Value;
use super::{ExecutableNode, ExecutionResult, ExecutionContext};

pub struct StartNode;

#[async_trait]
impl ExecutableNode for StartNode {
    async fn execute(&self, _context: &mut ExecutionContext, _inputs: HashMap<String, Value>, ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        outputs.insert("out".to_string(), Value::Null);
        Ok(ExecutionResult { outputs })
    }
}