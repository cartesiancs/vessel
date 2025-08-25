use async_trait::async_trait;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use tokio::sync::Mutex;
use std::{collections::HashMap, sync::Arc};
use anyhow::{Result, anyhow};
use serde_json::Value;

use crate::flow::{engine::ExecutionContext, types::ExecutionResult};

#[async_trait]
pub trait ExecutableNode: Send + Sync {
    async fn execute(
        &self, 
        context: &mut ExecutionContext, 
        inputs: HashMap<String, Value>,
        ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>
    ) -> Result<ExecutionResult>;
}

pub mod start;
pub mod log_message;
pub mod add_numbers;
pub mod set_variable;
pub mod condition;
pub mod number;
pub mod calc;
pub mod http;
pub mod loop_node;