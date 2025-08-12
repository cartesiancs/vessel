use async_trait::async_trait;
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use serde::Deserialize;
use serde_json::Value;
use super::{ExecutableNode, ExecutionResult, ExecutionContext};

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct SetVariableNodeData {
    variable_name: String,
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
    async fn execute(&self, context: &mut ExecutionContext, inputs: HashMap<String, Value>) -> Result<ExecutionResult> {
        if let Some(in_value) = inputs.get("in") {
            context.set_variable(&self.data.variable_name, in_value.clone());
            
            let mut outputs = HashMap::new();
            outputs.insert("out".to_string(), in_value.clone());
            return Ok(ExecutionResult { outputs });
        }
        
        Err(anyhow!("'SET_VARIABLE' node requires an input on the 'in' connector"))
    }
}