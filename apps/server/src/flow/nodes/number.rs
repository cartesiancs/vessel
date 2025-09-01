use async_trait::async_trait;
use tokio::sync::{broadcast};
use std::{collections::HashMap};
use anyhow::{Result};
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
        _broadcast_tx: broadcast::Sender<String>,
    ) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        let number_value = Value::from(self.data.number);

        outputs.insert("number".to_string(), number_value);

        Ok(ExecutionResult { outputs, ..Default::default()  })
    }
}