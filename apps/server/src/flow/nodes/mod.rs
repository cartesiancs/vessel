use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde_json::Value;
use std::collections::HashMap;
use tokio::{
    sync::{broadcast, mpsc},
    task::JoinHandle,
};

use crate::flow::{
    engine::{ExecutionContext, TriggerCommand},
    types::ExecutionResult,
};

#[async_trait]
pub trait ExecutableNode: Send + Sync {
    async fn execute(
        &self,
        context: &mut ExecutionContext,
        inputs: HashMap<String, Value>,
    ) -> Result<ExecutionResult>;

    fn is_trigger(&self) -> bool {
        false
    }

    fn start_trigger(
        &self,
        _node_id: String,
        _trigger_tx: mpsc::Sender<TriggerCommand>,
    ) -> Result<JoinHandle<()>> {
        Err(anyhow!("Node is not a trigger"))
    }
}

pub mod branch;
pub mod calc;
pub mod custom_node;
pub mod decode_h264;
pub mod decode_opus;
pub mod gst_decoder;
pub mod http;
pub mod interval;
pub mod json_selector;
pub mod log_message;
pub mod logic_operator;
pub mod mqtt_publish;
pub mod mqtt_subscribe;
pub mod rtp_stream_in;
pub mod set_variable;
pub mod start;
pub mod type_converter;
pub mod websocket_on;
pub mod websocket_send;
pub mod yolo_detect;
