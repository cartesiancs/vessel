use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use tokio::sync::broadcast;

use crate::flow::{engine::ExecutionContext, types::ExecutionResult};

#[async_trait]
pub trait ExecutableNode: Send + Sync {
    async fn execute(
        &self,
        context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult>;
}

pub mod calc;
pub mod condition;
pub mod http;
pub mod interval;
pub mod log_message;
pub mod logic_operator;
pub mod loop_node;
pub mod mqtt_publish;
pub mod mqtt_subscribe;
pub mod set_variable;
pub mod start;
pub mod type_converter;
