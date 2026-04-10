use crate::flow::engine::ExecutionContext;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;

use super::{ExecutableNode, ExecutionResult};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct ShowToastData {
    #[serde(default = "default_level")]
    level: String,
    title: Option<String>,
    message: String,
    #[serde(default = "default_duration_ms")]
    duration_ms: u64,
}

fn default_level() -> String {
    "info".to_string()
}

fn default_duration_ms() -> u64 {
    4000
}

pub struct ShowToastNode {
    data: ShowToastData,
    node_id: String,
}

impl ShowToastNode {
    pub fn new(node_data: &Value, node_id: String) -> Result<Self> {
        let data: ShowToastData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data, node_id })
    }
}

#[async_trait]
impl ExecutableNode for ShowToastNode {
    async fn execute(
        &self,
        context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let Some(exec_val) = inputs.get("exec") else {
            return Err(anyhow!("'exec' input is missing for SHOW_TOAST node"));
        };

        let level_lc = self.data.level.to_lowercase();
        let level = match level_lc.as_str() {
            "info" | "success" | "warning" | "error" => level_lc,
            _ => "info".to_string(),
        };

        let event_data = json!({
            "level": level,
            "title": self.data.title,
            "message": self.data.message,
            "duration_ms": self.data.duration_ms,
        });
        context.emit_flow_ui_event(&self.node_id, "SHOW_TOAST", "toast", event_data);

        let mut outputs = HashMap::new();
        outputs.insert("out".to_string(), exec_val.clone());

        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }
}
