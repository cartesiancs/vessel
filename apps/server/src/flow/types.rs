use std::collections::HashMap;
use serde_json::Value;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub outputs: HashMap<String, Value>,
}

impl Default for ExecutionResult {
    fn default() -> Self {
        Self {
            outputs: HashMap::new(),
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct Graph {
    // HashMap<String, Node>에서 Vec<Node>으로 변경합니다.
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    // id 필드를 다시 추가합니다.
    pub id: String,
    pub node_type: String,
    #[serde(default)]
    pub data: Value,
    #[serde(default)]
    pub connectors: Vec<Connector>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Edge {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Connector {
    pub id: String,
    pub name: String,
}