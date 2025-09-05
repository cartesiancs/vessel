use anyhow::{anyhow, Result};
use rumqttc::AsyncClient;
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{broadcast, mpsc, watch, Mutex};
use tokio::task::JoinHandle;
use tokio::time;
use tracing::{error, info};

use crate::flow::nodes::branch::BranchNode;
use crate::flow::nodes::decode_opus::DecodeOpusNode;
use crate::flow::nodes::json_selector::JsonSelectorNode;
use crate::flow::nodes::mqtt_publish::MqttPublishNode;
use crate::flow::nodes::mqtt_subscribe::MqttSubscribeNode;
use crate::flow::nodes::rtp_stream_in::RtpStreamInNode;
use crate::flow::nodes::type_converter::TypeConverterNode;
use crate::flow::nodes::{
    calc::CalcNode, http::HttpNode, interval::IntervalNode, log_message::LogMessageNode,
    logic_operator::LogicOpetatorNode, set_variable::SetVariableNode, start::StartNode,
    ExecutableNode,
};
use crate::flow::types::{Graph, Node};
use crate::state::MqttMessage;
use crate::state::StreamManager;

pub struct ExecutionContext {
    variables: HashMap<String, Value>,
    mqtt_client: Option<AsyncClient>,
    broadcast_tx: broadcast::Sender<String>,
}

impl ExecutionContext {
    pub fn new(mqtt_client: Option<AsyncClient>, broadcast_tx: broadcast::Sender<String>) -> Self {
        Self {
            variables: HashMap::new(),
            mqtt_client,
            broadcast_tx,
        }
    }

    pub fn set_variable(&mut self, name: &str, value: Value) {
        self.variables.insert(name.to_string(), value);
    }

    pub fn get_variable(&self, name: &str) -> Option<&Value> {
        self.variables.get(name)
    }

    pub fn get_broadcast(&self) -> broadcast::Sender<String> {
        self.broadcast_tx.clone()
    }

    pub fn mqtt_client(&self) -> &Option<AsyncClient> {
        &self.mqtt_client
    }
}

pub struct FlowController {
    shutdown_tx: watch::Sender<bool>,
}

impl FlowController {
    pub fn stop(&self) {
        self.shutdown_tx.send(true).ok();
    }
}

#[derive(Debug)]
pub struct TriggerCommand {
    pub node_id: String,
    pub inputs: HashMap<String, Value>,
}

pub struct FlowEngine {
    pub nodes: HashMap<String, Node>,
    data_flow_graph: HashMap<String, Vec<(String, String, String)>>,
    expected_input_counts: HashMap<String, usize>,
    mqtt_tx: Option<broadcast::Sender<MqttMessage>>,
    stream_manager: StreamManager,
}

impl FlowEngine {
    pub fn new(
        graph: Graph,
        mqtt_tx: Option<broadcast::Sender<MqttMessage>>,
        stream_manager: StreamManager,
    ) -> Result<Self> {
        let nodes_map: HashMap<String, Node> =
            graph.nodes.into_iter().map(|n| (n.id.clone(), n)).collect();

        let mut connector_to_node_map = HashMap::new();
        let mut connector_name_map = HashMap::new();
        for node in nodes_map.values() {
            for connector in &node.connectors {
                connector_to_node_map.insert(connector.id.clone(), node.id.clone());
                connector_name_map.insert(connector.id.clone(), connector.name.clone());
            }
        }

        let mut data_flow_graph: HashMap<String, Vec<(String, String, String)>> = HashMap::new();
        let mut expected_input_counts: HashMap<String, usize> = HashMap::new();

        for edge in &graph.edges {
            let source_node_id = connector_to_node_map
                .get(&edge.source)
                .ok_or_else(|| anyhow!("Node for source connector '{}' not found", edge.source))?;
            let target_node_id = connector_to_node_map
                .get(&edge.target)
                .ok_or_else(|| anyhow!("Node for target connector '{}' not found", edge.target))?;

            let source_connector_name = connector_name_map
                .get(&edge.source)
                .ok_or_else(|| anyhow!("Name for source connector '{}' not found", edge.source))?;
            let target_connector_name = connector_name_map
                .get(&edge.target)
                .ok_or_else(|| anyhow!("Name for target connector '{}' not found", edge.target))?;

            data_flow_graph
                .entry(source_node_id.clone())
                .or_default()
                .push((
                    source_connector_name.clone(),
                    target_node_id.clone(),
                    target_connector_name.clone(),
                ));

            *expected_input_counts
                .entry(target_node_id.clone())
                .or_insert(0) += 1;
        }

        Ok(Self {
            nodes: nodes_map,
            data_flow_graph,
            expected_input_counts,
            mqtt_tx,
            stream_manager,
        })
    }

    pub fn get_node_by_id(&self, node_id: &str) -> Option<&Node> {
        self.nodes.get(node_id)
    }

    pub fn get_start_nodes(&self) -> Vec<String> {
        self.nodes
            .keys()
            .filter(|node_id| *self.expected_input_counts.get(*node_id).unwrap_or(&0) == 0)
            .cloned()
            .collect()
    }

    pub fn get_source_node_ids(&self) -> Vec<String> {
        self.nodes
            .iter()
            .filter(|(id, _)| *self.expected_input_counts.get(*id).unwrap_or(&0) == 0)
            .map(|(id, _)| id.clone())
            .collect()
    }

    pub fn get_node_instance(
        &self,
        node_id: &str,
        source_node_ids: Vec<String>,
    ) -> Result<Box<dyn ExecutableNode>> {
        let node = self
            .nodes
            .get(node_id)
            .ok_or_else(|| anyhow!("Node not found: '{}'", node_id))?;
        match node.node_type.as_str() {
            "START" => Ok(Box::new(StartNode)),
            "SET_VARIABLE" => Ok(Box::new(SetVariableNode::new(&node.data)?)),
            "LOG_MESSAGE" => Ok(Box::new(LogMessageNode)),
            "CALCULATION" => Ok(Box::new(CalcNode::new(&node.data)?)),
            "HTTP_REQUEST" => Ok(Box::new(HttpNode::new(&node.data)?)),
            "LOGIC_OPERATOR" => Ok(Box::new(LogicOpetatorNode::new(&node.data)?)),
            "INTERVAL" => Ok(Box::new(IntervalNode::new(&node.data)?)),
            "MQTT_PUBLISH" => Ok(Box::new(MqttPublishNode::new(&node.data)?)),
            "MQTT_SUBSCRIBE" => {
                let rx = self
                    .mqtt_tx
                    .as_ref()
                    .ok_or_else(|| {
                        anyhow!("MQTT client is not configured for MQTT_SUBSCRIBE node")
                    })?
                    .subscribe();
                Ok(Box::new(MqttSubscribeNode::new(
                    &node.data,
                    rx,
                    source_node_ids,
                )?))
            }
            "TYPE_CONVERTER" => Ok(Box::new(TypeConverterNode::new(&node.data)?)),
            "RTP_STREAM_IN" => Ok(Box::new(RtpStreamInNode::new(
                &node.data,
                self.stream_manager.clone(),
                source_node_ids,
            )?)),
            "DECODE_OPUS" => Ok(Box::new(DecodeOpusNode::new()?)),
            "BRANCH" => Ok(Box::new(BranchNode)),
            "JSON_SELECTOR" => Ok(Box::new(JsonSelectorNode::new(&node.data)?)),

            _ => Err(anyhow!(
                "Unknown or unimplemented node type: {}",
                node.node_type
            )),
        }
    }

    pub async fn start(
        self: Arc<Self>,
        broadcast_tx: broadcast::Sender<String>,
        mqtt_client: Option<AsyncClient>,
    ) -> (
        FlowController,
        JoinHandle<Result<()>>,
        mpsc::Sender<TriggerCommand>,
    ) {
        let (shutdown_tx, mut shutdown_rx) = watch::channel(false);
        let (trigger_tx, mut trigger_rx) = mpsc::channel::<TriggerCommand>(100);
        let execution_queue = Arc::new(Mutex::new(VecDeque::new()));
        let node_input_data =
            Arc::new(Mutex::new(HashMap::<String, HashMap<String, Value>>::new()));
        let ws_message = json!({
            "type": "log_message",
            "payload": "Executing flow..."
        });
        if let Ok(payload_str) = serde_json::to_string(&ws_message) {
            if broadcast_tx.clone().send(payload_str).is_err() {
                error!("Failed to send health check response.");
            }
        }
        {
            let mut queue = execution_queue.lock().await;
            for node_id in self.get_source_node_ids() {
                if let Ok(instance) = self.get_node_instance(&node_id, vec![]) {
                    if !instance.is_trigger() {
                        queue.push_back(node_id.clone());
                    }
                }
            }
        }
        let engine_clone = Arc::clone(&self);
        let handle = tokio::spawn(async move {
            let self_ = engine_clone;
            let mut context = ExecutionContext::new(mqtt_client, broadcast_tx);
            info!("Flow Engine task started. Entering main execution loop...");
            loop {
                if *shutdown_rx.borrow() {
                    break;
                }
                let maybe_node_id = execution_queue.lock().await.pop_front();
                if let Some(node_id) = maybe_node_id {
                    let node_instance = match self_.get_node_instance(&node_id, vec![]) {
                        Ok(instance) => instance,
                        Err(e) => {
                            error!("Failed to create instance for node {}: {}", node_id, e);
                            continue;
                        }
                    };
                    let inputs = node_input_data
                        .lock()
                        .await
                        .remove(&node_id)
                        .unwrap_or_default();
                    match node_instance.execute(&mut context, inputs).await {
                        Ok(result) => {
                            for trigger in result.triggers {
                                let mut queue = execution_queue.lock().await;
                                node_input_data
                                    .lock()
                                    .await
                                    .entry(trigger.node_id.clone())
                                    .or_default()
                                    .extend(trigger.inputs);
                                queue.push_back(trigger.node_id);
                            }
                            if let Some(connections) = self_.data_flow_graph.get(&node_id) {
                                for (source_connector, target_node_id, target_connector) in
                                    connections
                                {
                                    if let Some(output_value) = result.outputs.get(source_connector)
                                    {
                                        let mut data_map = node_input_data.lock().await;
                                        let target_inputs =
                                            data_map.entry(target_node_id.clone()).or_default();
                                        target_inputs
                                            .insert(target_connector.clone(), output_value.clone());
                                        let expected_count = *self_
                                            .expected_input_counts
                                            .get(target_node_id)
                                            .unwrap_or(&0);
                                        if target_inputs.len() >= expected_count {
                                            execution_queue
                                                .lock()
                                                .await
                                                .push_back(target_node_id.clone());
                                        }
                                    }
                                }
                            }
                        }
                        Err(e) => {
                            error!("Error executing node {}: {}", node_id, e);
                        }
                    }
                } else {
                    tokio::select! {
                        biased;
                        _ = shutdown_rx.changed() => {
                            if *shutdown_rx.borrow() {
                                break;
                            }
                        },
                        Some(command) = trigger_rx.recv() => {
                            let mut data_map = node_input_data.lock().await;
                            data_map.entry(command.node_id.clone()).or_default().extend(command.inputs);
                            execution_queue.lock().await.push_back(command.node_id);
                        },
                        else => {
                            break;
                        }
                    }
                }
            }
            info!("Flow execution loop stopped.");
            Ok(())
        });
        (FlowController { shutdown_tx }, handle, trigger_tx)
    }
}
