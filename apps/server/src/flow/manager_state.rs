use crate::{
    db,
    flow::{
        engine::{FlowController, FlowEngine},
        types::Graph,
    },
    state::{DbPool, MqttMessage, StreamManager},
};
use anyhow::Result;
use rumqttc::AsyncClient;
use std::{collections::HashMap, sync::Arc};
use tokio::{
    sync::{broadcast, mpsc},
    task::JoinHandle,
};
use tracing::{error, info};

pub enum FlowManagerCommand {
    StartFlow {
        flow_id: i32,
        graph: Graph,
        broadcast_tx: broadcast::Sender<String>,
    },
    StopFlow {
        flow_id: i32,
    },
    GetAllFlows {
        responder: tokio::sync::oneshot::Sender<Vec<(i32, bool)>>,
        pool: DbPool,
    },
}

struct ActiveFlow {
    controller: FlowController,
    _handle: JoinHandle<Result<()>>,
    trigger_tasks: Vec<JoinHandle<()>>,
}

pub struct FlowManagerActor {
    receiver: mpsc::Receiver<FlowManagerCommand>,
    active_flows: HashMap<i32, ActiveFlow>,
    mqtt_client: Option<AsyncClient>,
    mqtt_tx: broadcast::Sender<MqttMessage>,
    stream_manager: StreamManager,
}

impl FlowManagerActor {
    pub fn new(
        receiver: mpsc::Receiver<FlowManagerCommand>,
        mqtt_client: Option<AsyncClient>,
        mqtt_tx: broadcast::Sender<MqttMessage>,
        stream_manager: StreamManager,
    ) -> Self {
        Self {
            receiver,
            active_flows: HashMap::new(),
            mqtt_client,
            mqtt_tx,
            stream_manager,
        }
    }

    pub async fn run(&mut self) {
        while let Some(cmd) = self.receiver.recv().await {
            match cmd {
                FlowManagerCommand::StartFlow {
                    flow_id,
                    graph,
                    broadcast_tx,
                } => {
                    if self.active_flows.contains_key(&flow_id) {
                        error!("Flow with ID {} is already running.", flow_id);
                        continue;
                    }
                    info!("Starting flow execution for flow_id: {}", flow_id);
                    match FlowEngine::new(
                        graph,
                        Some(self.mqtt_tx.clone()),
                        self.stream_manager.clone(),
                    ) {
                        Ok(engine) => {
                            let engine = Arc::new(engine);
                            let source_node_ids = engine.get_source_node_ids();
                            let (controller, handle, trigger_tx) = engine
                                .clone()
                                .start(broadcast_tx, self.mqtt_client.clone())
                                .await;
                            let mut trigger_tasks = Vec::new();
                            for node_id in engine.nodes.keys() {
                                if let Ok(mut node_instance) =
                                    engine.get_node_instance(node_id, source_node_ids.clone())
                                {
                                    if node_instance.is_trigger() {
                                        match node_instance
                                            .start_trigger(node_id.clone(), trigger_tx.clone())
                                        {
                                            Ok(task_handle) => trigger_tasks.push(task_handle),
                                            Err(e) => error!(
                                                "Failed to start trigger for node {}: {}",
                                                node_id, e
                                            ),
                                        }
                                    }
                                }
                            }
                            self.active_flows.insert(
                                flow_id,
                                ActiveFlow {
                                    controller,
                                    _handle: handle,
                                    trigger_tasks,
                                },
                            );
                        }
                        Err(e) => {
                            error!("Failed to create flow engine for flow {}: {}", flow_id, e);
                        }
                    }
                }
                FlowManagerCommand::StopFlow { flow_id } => {
                    if let Some(active_flow) = self.active_flows.remove(&flow_id) {
                        info!("Stop signal sent to flow_id: {}", flow_id);
                        active_flow.controller.stop();
                        for task in active_flow.trigger_tasks {
                            task.abort();
                        }
                    }
                }
                FlowManagerCommand::GetAllFlows { responder, pool } => {
                    let all_db_flows = db::repository::get_all_flows(&pool).unwrap_or_default();
                    let status: Vec<(i32, bool)> = all_db_flows
                        .into_iter()
                        .map(|f| (f.id, self.active_flows.contains_key(&f.id)))
                        .collect();
                    let _ = responder.send(status);
                }
            }
        }
    }
}
