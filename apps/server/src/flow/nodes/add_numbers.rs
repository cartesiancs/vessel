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

pub struct AddNumbersNode;

#[async_trait]
impl ExecutableNode for AddNumbersNode {
    async fn execute(&self, _context: &mut ExecutionContext, inputs: HashMap<String, Value>, ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>) -> Result<ExecutionResult> {
        let a = inputs.get("a").and_then(Value::as_f64).ok_or_else(|| anyhow!("Input 'a' is not a valid number"))?;
        let b = inputs.get("b").and_then(Value::as_f64).ok_or_else(|| anyhow!("Input 'b' is not a valid number"))?;

        println!("Adding numbers: a = {}, b = {}", a, b);
        let result = a + b;
        let mut outputs = HashMap::new();
        // 프론트엔드 ADD 노드의 출력 커넥터 이름은 "number" 입니다.
        outputs.insert("number".to_string(), Value::from(result));

        Ok(ExecutionResult { outputs })
    }
}