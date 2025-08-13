use async_trait::async_trait;
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use serde::Deserialize;
use serde_json::{Number, Value};
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
    async fn execute(&self, _context: &mut ExecutionContext, _inputs: HashMap<String, Value>) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        let value = Value::from(self.data.variable.clone());

        outputs.insert("out".to_string(), value);

        Ok(ExecutionResult { outputs })
        
    }
}