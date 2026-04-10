use anyhow::Result;
use async_trait::async_trait;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use tokio::{
    sync::{broadcast, mpsc},
    task::JoinHandle,
};
use tracing::warn;

use super::{ExecutableNode, ExecutionResult};
use crate::flow::engine::{ExecutionContext, TriggerCommand};
use crate::state::DashboardUiEvent;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DashboardEventListenerNodeData {
    pub listener_id: String,
}

pub struct DashboardEventListenerNode {
    data: DashboardEventListenerNodeData,
    dashboard_rx: broadcast::Receiver<DashboardUiEvent>,
}

impl DashboardEventListenerNode {
    pub fn new(
        node_data: &Value,
        dashboard_rx: broadcast::Receiver<DashboardUiEvent>,
    ) -> Result<Self> {
        let data: DashboardEventListenerNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data, dashboard_rx })
    }
}

#[async_trait]
impl ExecutableNode for DashboardEventListenerNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        if let Some(payload) = inputs.get("payload") {
            outputs.insert("payload".to_string(), payload.clone());
        }
        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }

    fn is_trigger(&self) -> bool {
        true
    }

    fn start_trigger(
        &self,
        node_id: String,
        trigger_tx: mpsc::Sender<TriggerCommand>,
    ) -> Result<JoinHandle<()>> {
        let target_id = self.data.listener_id.trim().to_string();
        let mut rx = self.dashboard_rx.resubscribe();

        let handle = tokio::spawn(async move {
            loop {
                match rx.recv().await {
                    Ok(ev) => {
                        if ev.listener_id != target_id {
                            continue;
                        }
                        let payload = serde_json::to_value(&ev).unwrap_or(json!({}));
                        let mut inputs = HashMap::new();
                        inputs.insert("payload".to_string(), payload);

                        let cmd = TriggerCommand {
                            node_id: node_id.clone(),
                            inputs,
                        };

                        if trigger_tx.send(cmd).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        warn!(
                            "DASHBOARD_EVENT_LISTENER lagged, skipped {} messages",
                            skipped
                        );
                        continue;
                    }
                    Err(_) => break,
                }
            }
        });
        Ok(handle)
    }
}
