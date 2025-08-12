use async_trait::async_trait;
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use serde_json::Value;
use super::{ExecutableNode, ExecutionResult};

pub struct AddNumbersNode;

#[async_trait]
impl ExecutableNode for AddNumbersNode {
    async fn execute(&self, inputs: HashMap<String, Value>) -> Result<ExecutionResult> {
        let a = inputs.get("a").and_then(Value::as_f64).ok_or_else(|| anyhow!("Input 'a' is not a valid number"))?;
        let b = inputs.get("b").and_then(Value::as_f64).ok_or_else(|| anyhow!("Input 'b' is not a valid number"))?;

        let result = a + b;
        let mut outputs = HashMap::new();
        outputs.insert("result".to_string(), Value::from(result));

        Ok(ExecutionResult { outputs })
    }
}