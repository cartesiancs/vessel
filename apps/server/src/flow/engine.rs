use std::collections::{HashMap, VecDeque};
use anyhow::{Result, anyhow};
use serde_json::Value;

use crate::flow::types::{Graph, Node, ExecutionResult, Edge};
use crate::flow::nodes::{
    ExecutableNode,
    start::StartNode,
    log_message::LogMessageNode,
    add_numbers::AddNumbersNode,
    set_variable::SetVariableNode,
    condition::ConditionNode,
};

pub struct FlowEngine {
    nodes: HashMap<String, Node>,
    edges: Vec<Edge>,
    adjacency: HashMap<String, Vec<(String, String)>>,
    connector_to_node_map: HashMap<String, String>,
    connector_name_map: HashMap<String, String>,
}

impl FlowEngine {
    pub fn new(graph: Graph) -> Result<Self> {
        let nodes_map: HashMap<String, Node> =
            graph.nodes.into_iter().map(|n| (n.id.clone(), n)).collect();

        let mut connector_to_node_map = HashMap::new();
        let mut connector_name_map = HashMap::new();
        let mut adjacency: HashMap<String, Vec<(String, String)>> = HashMap::new();

        for (node_id, node) in &nodes_map {
            adjacency.entry(node_id.clone()).or_default();
            for connector in &node.connectors {
                connector_to_node_map.insert(connector.id.clone(), node.id.clone());
                connector_name_map.insert(connector.id.clone(), connector.name.clone());
            }
        }

        for edge in &graph.edges {
            let source_node_id = connector_to_node_map.get(&edge.source)
                .ok_or_else(|| anyhow!("Node for source connector '{}' not found", edge.source))?;
            
            let target_node_id = connector_to_node_map.get(&edge.target)
                .ok_or_else(|| anyhow!("Node for target connector '{}' not found", edge.target))?;

            let source_connector_name = connector_name_map.get(&edge.source)
                .ok_or_else(|| anyhow!("Name for source connector '{}' not found", edge.source))?;
            
            adjacency
                .entry(source_node_id.clone())
                .or_default()
                .push((target_node_id.clone(), source_connector_name.clone()));
        }

        Ok(Self {
            nodes: nodes_map,
            edges: graph.edges,
            adjacency,
            connector_to_node_map,
            connector_name_map,
        })
    }

    fn get_node_instance(&self, node_id: &str) -> Result<Box<dyn ExecutableNode>> {
        let node = self.nodes.get(node_id).ok_or_else(|| anyhow!("Node not found: '{}'", node_id))?;
        match node.node_type.as_str() {
            "NUMBER" => Ok(Box::new(SetVariableNode::new(&node.data)?)),
            "START" => Ok(Box::new(StartNode)),
            "LOG_MESSAGE" => Ok(Box::new(LogMessageNode)),
            "ADD" => Ok(Box::new(AddNumbersNode)),
            "SET_VARIABLE" => Ok(Box::new(SetVariableNode::new(&node.data)?)),
            "CONDITION" => Ok(Box::new(ConditionNode::new(&node.data)?)),
            _ => Err(anyhow!("Unknown node type: {}", node.node_type)),
        }
    }

     pub async fn run(&self) -> Result<()> {
        let mut in_degrees: HashMap<&String, usize> = HashMap::new();

        // 1. 모든 노드의 입력 카운트(in-degree)를 계산합니다.
        for edge in &self.edges {
            if let Some(target_node_id) = self.connector_to_node_map.get(&edge.target) {
                *in_degrees.entry(target_node_id).or_insert(0) += 1;
            }
        }

        let mut queue: VecDeque<(String, HashMap<String, Value>)> = VecDeque::new();

        // 2. 입력이 0인 노드를 찾아 시작 큐에 추가합니다.
        for node_id in self.nodes.keys() {
            if in_degrees.get(node_id).unwrap_or(&0) == &0 {
                println!("Found start node: {}", node_id);
                queue.push_back((node_id.clone(), HashMap::new()));
            }
        }

        if queue.is_empty() && !self.nodes.is_empty() {
            return Err(anyhow!("No start node found (a node with no inputs)"));
        }
        
        // 3. 기존의 실행 루프는 그대로 사용합니다.
        while let Some((node_id, inputs)) = queue.pop_front() {
            let node_instance = self.get_node_instance(&node_id)?;
            let result = node_instance.execute(inputs).await?;

            if let Some(next_connections) = self.adjacency.get(&node_id) {
                for (output_name, _output_value) in &result.outputs {
                    for (target_node_id, source_connector_name) in next_connections {
                        if source_connector_name == output_name {
                             let next_inputs = self.prepare_inputs_for(target_node_id, &result)?;
                             queue.push_back((target_node_id.clone(), next_inputs));
                        }
                    }
                }
            }
        }
        Ok(())
    }
    
    fn prepare_inputs_for(&self, node_id: &str, prev_result: &ExecutionResult) -> Result<HashMap<String, Value>> {
        let mut inputs = HashMap::new();
        
        for edge in &self.edges {
            let target_node_id = self.connector_to_node_map.get(&edge.target)
                .ok_or_else(|| anyhow!("Node for target connector '{}' not found", edge.target))?;

            if target_node_id != node_id {
                continue;
            }
            
            let source_connector_name = self.connector_name_map.get(&edge.source)
                .ok_or_else(|| anyhow!("Name for source connector '{}' not found", edge.source))?;

            if let Some(val) = prev_result.outputs.get(source_connector_name) {
                 let target_connector_name = self.connector_name_map.get(&edge.target)
                    .ok_or_else(|| anyhow!("Name for target connector '{}' not found", edge.target))?;
                 inputs.insert(target_connector_name.clone(), val.clone());
            }
        }
        Ok(inputs)
    }
}