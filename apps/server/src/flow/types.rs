use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Trigger {
    pub node_id: String,
    pub inputs: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ExecutionResult {
    pub outputs: HashMap<String, Value>,
    #[serde(default)]
    pub triggers: Vec<Trigger>,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConnectorKind {
    #[serde(rename = "in")]
    In,
    #[serde(rename = "out")]
    Out,
}
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Connector {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: ConnectorKind,
}
