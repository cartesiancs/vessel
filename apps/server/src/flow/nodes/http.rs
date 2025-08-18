use async_trait::async_trait;
use axum::{extract::ws::{Message, WebSocket}, http};
use futures_util::stream::SplitSink;
use tokio::sync::Mutex;
use std::{collections::HashMap, sync::Arc};
use anyhow::{Result, anyhow};
use serde::Deserialize;
use serde_json::Value;
use reqwest::{get, Client};
use crate::flow::engine::ExecutionContext;

use super::{ExecutableNode, ExecutionResult};


#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct HttpNodeData {
    url: String,
    http_method: String,
}

pub struct HttpNode {
    data: HttpNodeData,
}

impl HttpNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: HttpNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for HttpNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
        _ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>,
    ) -> Result<ExecutionResult> {
        let client = Client::new();
        let url = &self.data.url;
        let method = self.data.http_method.to_uppercase();

        let response = match method.as_str() {
            "GET" => client.get(url).send().await?,
            "POST" => {
                let body = inputs.get("body").cloned().unwrap_or(Value::Null);
                client.post(url).send().await?
            }
            "PUT" => {
                let body = inputs.get("body").cloned().unwrap_or(Value::Null);
                client.put(url).send().await?
            }
            "DELETE" => client.delete(url).send().await?,
            _ => {
                return Err(anyhow!("Unsupported HTTP method: {}", self.data.http_method));
            }
        };

        let result_body = if response.status().is_success() {
            response.text().await?
        } else {
            return Err(anyhow!(
                "HTTP request failed with status: {}",
                response.status()
            ));
        };

        let mut outputs = HashMap::new();
        outputs.insert("result".to_string(), Value::from(result_body));

        Ok(ExecutionResult { outputs })
    }
}