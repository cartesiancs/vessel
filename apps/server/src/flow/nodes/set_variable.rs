use async_trait::async_trait;
use std::collections::HashMap;
use anyhow::{Result};
use serde::Deserialize;
use serde_json::Value;
use super::{ExecutableNode, ExecutionResult};

#[derive(Deserialize)]
struct SetVariableNodeData {
    // "value" 또는 "number" 라는 키를 모두 "number" 필드로 받습니다.
    #[serde(alias = "value")]
    number: Value,
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
    async fn execute(&self, _inputs: HashMap<String, Value>) -> Result<ExecutionResult> {
        let mut outputs = HashMap::new();
        // 노드의 출력 커넥터 이름이 "number" 또는 "value"일 수 있으므로,
        // 둘 다 동일한 결과값을 출력하도록 합니다.
        let output_value = self.data.number.clone();
        outputs.insert("value".to_string(), output_value.clone());
        outputs.insert("number".to_string(), output_value);

        Ok(ExecutionResult { outputs })
    }
}