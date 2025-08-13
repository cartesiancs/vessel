use async_trait::async_trait;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use tokio::sync::Mutex;
use std::{collections::HashMap, sync::Arc};
use anyhow::{Result, anyhow};
use serde::Deserialize;
use serde_json::Value;

use crate::flow::engine::ExecutionContext;
use super::{ExecutableNode, ExecutionResult};

#[derive(Deserialize)]
struct NumberNodeData {
    number: f64,
}

pub struct NumberNode {
    data: NumberNodeData,
}

impl NumberNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: NumberNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for NumberNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        _inputs: HashMap<String, Value>,
        ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>
    ) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        let number_value = Value::from(self.data.number);

        outputs.insert("number".to_string(), number_value);

        Ok(ExecutionResult { outputs })
    }
}