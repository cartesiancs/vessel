use crate::flow::engine::ExecutionContext;
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use reqwest::Client;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use tokio::sync::broadcast;

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
    ) -> Result<ExecutionResult> {
        let client = Client::new();
        let url = &self.data.url;
        let method = self.data.http_method.to_uppercase();

        let response = match method.as_str() {
            "GET" => client.get(url).send().await?,
            "POST" => {
                let _body = inputs.get("body").cloned().unwrap_or(Value::Null);
                client.post(url).send().await?
            }
            "PUT" => {
                let _body = inputs.get("body").cloned().unwrap_or(Value::Null);
                client.put(url).send().await?
            }
            "DELETE" => client.delete(url).send().await?,
            _ => {
                return Err(anyhow!(
                    "Unsupported HTTP method: {}",
                    self.data.http_method
                ));
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

        Ok(ExecutionResult {
            outputs,
            ..Default::default()
        })
    }
}
