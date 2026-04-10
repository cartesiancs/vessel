use crate::flow::engine::ExecutionContext;
use crate::flow::types::{ExecutionResult, Node};
use anyhow::{anyhow, Result};
use async_trait::async_trait;
use rhai::packages::Package;
use rhai::{Dynamic, Engine, Scope};
use rhai_rand::RandomPackage;
use serde_json::Value;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::task;
use tracing::{error, info};

use super::ExecutableNode;

pub struct CustomNode {
    node: Node,
}

impl CustomNode {
    pub fn new(node: &Node) -> Result<Self> {
        let node = node.clone();
        Ok(Self { node })
    }
}

#[async_trait]
impl ExecutableNode for CustomNode {
    async fn execute(
        &self,
        _context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult> {
        let path_value = self
            .node
            .data
            .get("path")
            .ok_or_else(|| anyhow!("'path' not found in node data"))?;
        let original_path = path_value
            .as_str()
            .ok_or_else(|| anyhow!("'path' must be a string"))?;

        let script_path = original_path.replace("{:code}", "./storage");

        let code = match tokio::fs::read_to_string(&script_path).await {
            Ok(c) => c,
            Err(e) => {
                let err_msg = format!("Failed to read script at '{}': {}", script_path, e);
                error!("{}", err_msg);
                return Err(anyhow!(err_msg));
            }
        };

        let blocking_task = task::spawn_blocking(move || {
            let mut engine = Engine::new();
            engine.register_global_module(RandomPackage::new().as_shared_module());
            engine.register_fn("epoch_ms", || -> i64 {
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_millis() as i64
            });

            let inputs_dynamic: Dynamic = rhai::serde::to_dynamic(&inputs)
                .map_err(|e| anyhow!("Input conversion failed: {}", e))?;

            let ast = engine
                .compile(&code)
                .map_err(|e| anyhow!("Script compilation failed: {}", e))?;
            let mut scope = Scope::new();
            let result: Dynamic = engine
                .call_fn(&mut scope, &ast, "main", (inputs_dynamic,))
                .map_err(|e| anyhow!("Script execution failed: {}", e))?;

            let result_value: Value = rhai::serde::from_dynamic(&result)
                .map_err(|e| anyhow!("Result conversion failed: {}", e))?;
            let outputs: HashMap<String, Value> = match result_value {
                Value::Object(map) => map.into_iter().collect(),
                _ => return Err(anyhow!("Script must return an object map")),
            };
            Ok(outputs)
        });

        match blocking_task.await {
            Ok(Ok(outputs)) => {
                info!("Script executed successfully");
                Ok(ExecutionResult {
                    outputs,
                    ..Default::default()
                })
            }
            Ok(Err(e)) => {
                error!("Error in script execution: {}", e);
                Err(e)
            }
            Err(e) => {
                error!("Failed to run script blocking task: {}", e);
                Err(anyhow!("Task join error: {}", e))
            }
        }
    }
}
