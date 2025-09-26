use anyhow::{anyhow, Result};
use async_trait::async_trait;
use futures_util::stream::StreamExt;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use tokio::{
    net::TcpStream,
    sync::mpsc,
    task::JoinHandle,
    time::{sleep, Duration},
};
use tokio_tungstenite::{
    connect_async, tungstenite::protocol::Message, MaybeTlsStream, WebSocketStream,
};
use tracing::{error, info, warn};
use url::Url;

use super::ExecutableNode;
use crate::{
    db::models::SystemConfiguration,
    flow::{
        engine::{ExecutionContext, TriggerCommand},
        types::ExecutionResult,
    },
    lib::system_configs::replace_config_placeholders,
};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebSocketOnNodeData {
    pub url: String,
}

pub struct WebSocketOnNode {
    data: WebSocketOnNodeData,
    system_configs: Vec<SystemConfiguration>,
}

impl WebSocketOnNode {
    pub fn new(node_data: &Value, system_configs: Vec<SystemConfiguration>) -> Result<Self> {
        let data: WebSocketOnNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self {
            data,
            system_configs,
        })
    }
}

async fn handle_connection(
    mut ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
    trigger_tx: &mpsc::Sender<TriggerCommand>,
    node_id: &str,
) {
    while let Some(msg) = ws_stream.next().await {
        println!("rsv");

        match msg {
            Ok(Message::Text(text)) => {
                let payload_value = match serde_json::from_str(&text) {
                    Ok(p) => p,
                    Err(_) => Value::String(text.to_string()),
                };
                let mut inputs = HashMap::new();
                inputs.insert("payload".to_string(), payload_value);
                let cmd = TriggerCommand {
                    node_id: node_id.to_string(),
                    inputs,
                };
                if trigger_tx.send(cmd).await.is_err() {
                    error!("Trigger channel closed. Stopping WebSocket listener.");
                    break;
                }
            }
            Ok(Message::Binary(_)) => {
                warn!("Received binary message, which is not currently supported. Ignoring.");
            }
            Ok(Message::Ping(_)) => {}
            Ok(Message::Pong(_)) => {}
            Ok(Message::Close(_)) => {
                info!("WebSocket connection closed by peer.");
                break;
            }
            Ok(Message::Frame(_)) => {
                warn!("Received raw frame, which is not currently supported. Ignoring.");
            }
            Err(e) => {
                error!("Error reading from WebSocket: {}", e);
                break;
            }
        }
    }
}

#[async_trait]
impl ExecutableNode for WebSocketOnNode {
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
        let url_str: String = self.data.url.clone();
        let result_url: String = replace_config_placeholders(&url_str, &self.system_configs);

        let handle = tokio::spawn(async move {
            loop {
                if let Err(e) = Url::parse(&result_url) {
                    error!(
                        "Invalid WebSocket URL '{}': {}. Aborting trigger.",
                        result_url, e
                    );
                    break;
                }

                info!("Connecting to WebSocket at {}", result_url);
                match connect_async(&result_url).await {
                    Ok((ws_stream, _)) => {
                        info!("Successfully connected to WebSocket: {}", result_url);
                        handle_connection(ws_stream, &trigger_tx, &node_id).await;
                        warn!("WebSocket connection lost. Reconnecting in 5 seconds...");
                    }
                    Err(e) => {
                        error!(
                            "Failed to connect to WebSocket '{}': {}. Retrying in 5 seconds...",
                            result_url, e
                        );
                    }
                }
                sleep(Duration::from_secs(5)).await;
            }
        });

        Ok(handle)
    }
}
