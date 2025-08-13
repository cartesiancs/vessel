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
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
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