use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Result, anyhow};
use axum::extract::ws::{Message, WebSocket};
use futures_util::{stream::SplitSink, SinkExt};
use serde::Deserialize; 
use serde_json::{Value, json};
use tokio::sync::{broadcast, watch, Mutex};
use tokio::task::JoinHandle;
use tokio::time; // timeout을 위해 추가
use tracing::{error, info};

use crate::flow::types::{Graph, Node};
use crate::flow::nodes::{
    ExecutableNode,
    start::StartNode,
    log_message::LogMessageNode,
    add_numbers::AddNumbersNode,
    set_variable::SetVariableNode,
    condition::ConditionNode,
    number::NumberNode,
    calc::CalcNode,
    http::HttpNode,
    loop_node::LoopNode,
    logic_operator::LogicOpetatorNode,
    interval::IntervalNode,
};

#[derive(Default)]
pub struct ExecutionContext {
    variables: HashMap<String, Value>,
}

impl ExecutionContext {
    pub fn set_variable(&mut self, name: &str, value: Value) {
        self.variables.insert(name.to_string(), value);
    }

    pub fn get_variable(&self, name: &str) -> Option<&Value> {
        self.variables.get(name)
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

pub struct FlowEngine {
    nodes: HashMap<String, Node>,
    data_flow_graph: HashMap<String, Vec<(String, String, String)>>,
    expected_input_counts: HashMap<String, usize>,
}

impl FlowEngine {
    pub fn new(graph: Graph) -> Result<Self> {

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
            let source_node_id = connector_to_node_map.get(&edge.source).ok_or_else(|| anyhow!("Node for source connector '{}' not found", edge.source))?;
            let target_node_id = connector_to_node_map.get(&edge.target).ok_or_else(|| anyhow!("Node for target connector '{}' not found", edge.target))?;

            let source_connector_name = connector_name_map.get(&edge.source).ok_or_else(|| anyhow!("Name for source connector '{}' not found", edge.source))?;
            let target_connector_name = connector_name_map.get(&edge.target).ok_or_else(|| anyhow!("Name for target connector '{}' not found", edge.target))?;

            data_flow_graph
                .entry(source_node_id.clone())
                .or_default()
                .push((
                    source_connector_name.clone(),
                    target_node_id.clone(),
                    target_connector_name.clone()
                ));
            
            *expected_input_counts.entry(target_node_id.clone()).or_insert(0) += 1;
        }

        Ok(Self {
            nodes: nodes_map,
            data_flow_graph,
            expected_input_counts,
        })
    }

    fn get_node_instance(&self, node_id: &str) -> Result<Box<dyn ExecutableNode>> {
        let node = self.nodes.get(node_id).ok_or_else(|| anyhow!("Node not found: '{}'", node_id))?;
        match node.node_type.as_str() {
            "START" => Ok(Box::new(StartNode)),
            "NUMBER" => Ok(Box::new(NumberNode::new(&node.data)?)),
            "ADD" => Ok(Box::new(AddNumbersNode)),
            "SET_VARIABLE" => Ok(Box::new(SetVariableNode::new(&node.data)?)),
            "CONDITION" => Ok(Box::new(ConditionNode::new(&node.data)?)),
            "LOG_MESSAGE" => Ok(Box::new(LogMessageNode)),
            "CALCULATION" => Ok(Box::new(CalcNode::new(&node.data)?)),
            "HTTP_REQUEST" => Ok(Box::new(HttpNode::new(&node.data)?)),
            "LOOP" => Ok(Box::new(LoopNode::new(&node.data)?)),
            "LOGIC_OPERATOR" => Ok(Box::new(LogicOpetatorNode::new(&node.data)?)),
            "INTERVAL" => Ok(Box::new(IntervalNode::new(&node.data)?)),
            _ => Err(anyhow!("Unknown or unimplemented node type: {}", node.node_type)),
        }
    }

    pub async fn start(self: Arc<Self>, broadcast_tx: broadcast::Sender<String>) -> (FlowController, JoinHandle<Result<()>>) {
        let (shutdown_tx, mut shutdown_rx) = watch::channel(false);
        let execution_queue = Arc::new(Mutex::new(VecDeque::new()));

        #[derive(Deserialize)]
        struct IntervalData {
            interval: u64,
            unit: String,
        }

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
            for (node_id, node) in &self.nodes {
                if *self.expected_input_counts.get(node_id).unwrap_or(&0) == 0 {
                    if node.node_type == "INTERVAL" {
                        if let Ok(data) = serde_json::from_value::<IntervalData>(node.data.clone()) {
                            let duration = match data.unit.as_str() {
                                "milliseconds" => Duration::from_millis(data.interval),
                                "seconds" => Duration::from_secs(data.interval),
                                "minutes" => Duration::from_secs(data.interval * 60),
                                _ => continue,
                            };
                            
                            let mut interval_shutdown_rx = shutdown_rx.clone();
                            let queue_clone = Arc::clone(&execution_queue);
                            let node_id_clone = node_id.clone();
                            tokio::spawn(async move {
                                let mut interval = time::interval(duration);
                                loop {
                                    tokio::select! {
                                        _ = interval.tick() => {
                                            queue_clone.lock().await.push_back(node_id_clone.clone());
                                        }
                                        _ = interval_shutdown_rx.changed() => {
                                            if *interval_shutdown_rx.borrow() { break; }
                                        }
                                    }
                                }
                            });
                        }
                    } else {
                        queue.push_back(node_id.clone());
                    }
                }
            }
        }
        
        let engine_clone = Arc::clone(&self);
        let handle = tokio::spawn(async move {
            let self_ = engine_clone;
            let mut context = ExecutionContext::default();
            let mut node_input_data: HashMap<String, HashMap<String, Value>> = HashMap::new();

            info!("Flow Engine task started. Entering main execution loop...");

            while !*shutdown_rx.borrow() {
                let maybe_node_id = execution_queue.lock().await.pop_front();

                if let Some(node_id) = maybe_node_id {
                    let node_instance = self_.get_node_instance(&node_id)?;
                    let mut inputs = node_input_data.remove(&node_id).unwrap_or_default();
                    
                    if let Some(node) = self_.nodes.get(&node_id) {
                        if node.node_type == "LOOP" {
                            if let Some(connections) = self_.data_flow_graph.get(&node_id) {
                                if let Some((_, target_node_id, target_connector_name)) = connections.iter().find(|(c, _, _)| c == "body") {
                                    inputs.insert("body_node_id".to_string(), json!(target_node_id));
                                    inputs.insert("body_input_name".to_string(), json!(target_connector_name));
                                }
                            }
                        }
                    }

                    let result = node_instance.execute(&mut context, inputs,  broadcast_tx.clone()).await?;

                    for trigger in result.triggers {
                        let mut queue = execution_queue.lock().await;
                        node_input_data.entry(trigger.node_id.clone()).or_default().extend(trigger.inputs);
                        queue.push_back(trigger.node_id);
                    }

                    if let Some(connections) = self_.data_flow_graph.get(&node_id) {
                        for (source_connector_name, target_node_id, target_connector_name) in connections {
                            if let Some(output_value) = result.outputs.get(source_connector_name) {
                                let target_inputs = node_input_data.entry(target_node_id.clone()).or_default();
                                target_inputs.insert(target_connector_name.clone(), output_value.clone());
                                
                                let expected_count = *self_.expected_input_counts.get(target_node_id).unwrap_or(&0);
                                if target_inputs.len() >= expected_count {
                                    execution_queue.lock().await.push_back(target_node_id.clone());
                                }
                            }
                        }
                    }
                } else {
                    let timeout_duration = Duration::from_millis(50);
                    let _ = time::timeout(timeout_duration, shutdown_rx.changed()).await;

                    if *shutdown_rx.borrow() {
                        break;
                    }
                }
            }

            info!("Flow execution loop stopped.");
            Ok(())
        });

        (FlowController { shutdown_tx }, handle)
    }
}