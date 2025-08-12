use async_trait::async_trait;
use std::collections::HashMap;
use anyhow::{Result, anyhow};
use serde_json::Value;

use crate::flow::{engine::ExecutionContext, types::ExecutionResult};

#[async_trait]
pub trait ExecutableNode: Send + Sync {
    async fn execute(&self, context: &mut ExecutionContext, inputs: HashMap<String, Value>) -> Result<ExecutionResult>;
}

pub mod start;
pub mod log_message;
pub mod add_numbers;
pub mod set_variable;
pub mod condition;
pub mod number;