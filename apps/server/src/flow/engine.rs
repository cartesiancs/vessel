use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use anyhow::{Result, anyhow};
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use serde_json::{Value, json};
use tokio::sync::Mutex;

use crate::flow::types::{Graph, Node, Edge};
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
            _ => Err(anyhow!("Unknown or unimplemented node type: {}", node.node_type)),
        }
    }

    pub async fn run(&self, ws_sender: Arc<Mutex<SplitSink<WebSocket, Message>>>) -> Result<()> {
        let mut context = ExecutionContext::default();
        let mut execution_queue: VecDeque<String> = VecDeque::new();
        let mut received_input_counts: HashMap<String, usize> = HashMap::new();
        let mut node_input_data: HashMap<String, HashMap<String, Value>> = HashMap::new();

        for node_id in self.nodes.keys() {
            if self.expected_input_counts.get(node_id).unwrap_or(&0) == &0 {
                execution_queue.push_back(node_id.clone());
            }
        }
        
        if execution_queue.is_empty() && !self.nodes.is_empty() {
            return Err(anyhow!("No start node found (a node with no inputs)"));
        }

        while let Some(node_id) = execution_queue.pop_front() {
            let node_instance = self.get_node_instance(&node_id)?;
            let mut inputs = node_input_data.get(&node_id).cloned().unwrap_or_default();
            
            if let Some(node) = self.nodes.get(&node_id) {
                if node.node_type == "LOOP" {
                    if let Some(connections) = self.data_flow_graph.get(&node_id) {
                        if let Some((_, target_node_id, target_connector_name)) = connections.iter().find(|(source_connector, _, _)| source_connector == "body") {
                            inputs.insert("body_node_id".to_string(), json!(target_node_id));
                            inputs.insert("body_input_name".to_string(), json!(target_connector_name));
                        }
                    }
                }
            }
            
            let result = node_instance.execute(&mut context, inputs, ws_sender.clone()).await?;

            for trigger in result.triggers {
                node_input_data
                    .entry(trigger.node_id.clone())
                    .or_default()
                    .extend(trigger.inputs);
                
                execution_queue.push_back(trigger.node_id);
            }

            if let Some(connections) = self.data_flow_graph.get(&node_id) {
                for (source_connector_name, target_node_id, target_connector_name) in connections {
                    if let Some(output_value) = result.outputs.get(source_connector_name) {
                        
                        let target_inputs = node_input_data.entry(target_node_id.clone()).or_default();
                        target_inputs.insert(target_connector_name.clone(), output_value.clone());

                        let received_count = received_input_counts.entry(target_node_id.clone()).or_insert(0);
                        *received_count += 1;

                        let expected_count = self.expected_input_counts.get(target_node_id).unwrap_or(&0);
                        if *received_count >= *expected_count {
                            execution_queue.push_back(target_node_id.clone());
                            received_input_counts.insert(target_node_id.clone(), 0);
                        }
                    }
                }
            }
        }

        Ok(())
    }
}