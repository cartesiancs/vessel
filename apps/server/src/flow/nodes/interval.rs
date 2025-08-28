use async_trait::async_trait;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::sync::{broadcast, Mutex};
use anyhow::{Result, anyhow};
use std::{collections::HashMap, sync::Arc, time::Duration};
use crate::flow::engine::ExecutionContext;

use super::{ExecutableNode, ExecutionResult};

#[derive(Deserialize, Debug, Clone)]
struct IntervalNodeData {
    interval: u64,
    unit: String,
}

pub struct IntervalNode {
    data: IntervalNodeData,
}

impl IntervalNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: IntervalNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }

    pub fn get_duration(&self) -> Result<Duration> {
        match self.data.unit.as_str() {
            "milliseconds" => Ok(Duration::from_millis(self.data.interval)),
            "seconds" => Ok(Duration::from_secs(self.data.interval)),
            "minutes" => Ok(Duration::from_secs(self.data.interval * 60)),
            _ => Err(anyhow!("Unsupported time unit: {}", self.data.unit)),
        }
    }
}

#[async_trait]
impl ExecutableNode for IntervalNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        _inputs: HashMap<String, Value>,
        broadcast_tx: broadcast::Sender<String>,
    ) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        outputs.insert("exec".to_string(), Value::Null);
        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }
}