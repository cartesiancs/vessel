use async_trait::async_trait;
use tokio::sync::{broadcast};
use std::{collections::HashMap};
use anyhow::{Result, anyhow};
use serde::Deserialize;
use serde_json::Value;
use crate::flow::engine::ExecutionContext;

use super::{ExecutableNode, ExecutionResult};


#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct CalcNodeData {
    operator_calc: String,
}

pub struct CalcNode {
    data: CalcNodeData,
}

impl CalcNode {
    pub fn new(node_data: &Value) -> Result<Self> {
        let data: CalcNodeData = serde_json::from_value(node_data.clone())?;
        Ok(Self { data })
    }
}

#[async_trait]
impl ExecutableNode for CalcNode {
    async fn execute(&self, _context: &mut ExecutionContext, inputs: HashMap<String, Value>, broadcast_tx: broadcast::Sender<String>,) -> Result<ExecutionResult> {
        let a = inputs.get("a").and_then(Value::as_f64).ok_or_else(|| anyhow!("Input 'a' is not a valid number"))?;
        let b = inputs.get("b").and_then(Value::as_f64).ok_or_else(|| anyhow!("Input 'b' is not a valid number"))?;
        let operatorCalc = Value::from(self.data.operator_calc.clone());
        let result;

        if operatorCalc == "+" {
            println!("Adding numbers: a = {}, b = {}", a, b);
            result = a + b;
        } else if operatorCalc == "-" {
            println!("Adding numbers: a = {}, b = {}", a, b);
            result = a - b;
        } else if operatorCalc == "/" {
            println!("Adding numbers: a = {}, b = {}", a, b);
            result = a / b;
        } else if operatorCalc == "*" {
            println!("Adding numbers: a = {}, b = {}", a, b);
            result = a * b;
        } else {
            println!("Adding numbers: a = {}, b = {}", a, b);
            result = a % b;
        } 

        let mut outputs = HashMap::new();
        outputs.insert("number".to_string(), Value::from(result));

        Ok(ExecutionResult { outputs, ..Default::default()  })
    }
}