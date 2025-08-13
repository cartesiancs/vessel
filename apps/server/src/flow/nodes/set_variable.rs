use async_trait::async_trait;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use tokio::sync::Mutex;
use std::{collections::HashMap, sync::Arc};
use anyhow::{Result, anyhow};
use serde::Deserialize;
use serde_json::Value;

use super::{ExecutableNode, ExecutionResult, ExecutionContext};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct SetVariableNodeData {
    variable_name: String,
    variable: String, 
    variable_type: Option<String>,
}

pub struct SetVariableNode {
    data: SetVariableNodeData,
}

impl SetVariableNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: SetVariableNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for SetVariableNode {
    async fn execute(&self, _context: &mut ExecutionContext, _inputs: HashMap<String, Value>, ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        let value = Value::from(self.data.variable.clone());

        outputs.insert("out".to_string(), value);

        Ok(ExecutionResult { outputs })
        
    }
}