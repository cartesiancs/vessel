use async_trait::async_trait;
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use serde::Deserialize;
use serde_json::Value;
use super::{ExecutableNode, ExecutionResult};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
enum Operator {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(Deserialize)]
struct ConditionNodeData {
    operator: Operator,
    operand: f64,
}

pub struct ConditionNode {
    data: ConditionNodeData,
}

impl ConditionNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: ConditionNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for ConditionNode {
    async fn execute(&self, inputs: HashMap<String, Value>) -> Result<ExecutionResult> {
        let input_val = inputs.get("input").and_then(Value::as_f64).ok_or_else(|| anyhow!("Conditional input is not a valid number"))?;

        let condition_met = match self.data.operator {
            Operator::GreaterThan => input_val > self.data.operand,
            Operator::LessThan => input_val < self.data.operand,
            Operator::EqualTo => (input_val - self.data.operand).abs() < f64::EPSILON,
        };

        let mut outputs = HashMap::new();
        if condition_met {
            outputs.insert("true".to_string(), inputs.get("input").unwrap().clone());
        } else {
            outputs.insert("false".to_string(), inputs.get("input").unwrap().clone());
        }

        Ok(ExecutionResult { outputs })
    }
}