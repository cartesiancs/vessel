use anyhow::Result;
use axum::extract::ws::{Message, WebSocket};
use futures_util::stream::SplitSink;
use std::{collections::HashMap, sync::Arc};
use tokio::{sync::{broadcast, mpsc, Mutex}, task::JoinHandle};
use crate::{db, flow::{engine::{FlowController, FlowEngine}, types::Graph}, state::DbPool};
use rumqttc::AsyncClient;

pub enum FlowManagerCommand {
    StartFlow {
        flow_id: i32,
        graph: Graph,
        broadcast_tx: broadcast::Sender<String>
    },
    StopFlow {
        flow_id: i32,
    },
    GetAllFlows {
        responder: tokio::sync::oneshot::Sender<Vec<(i32, bool)>>,
        pool: DbPool
    },
}

pub struct FlowManagerActor {
    receiver: mpsc::Receiver<FlowManagerCommand>,
    active_flows: HashMap<i32, (FlowController, JoinHandle<Result<()>>)>,
    mqtt_client: Option<AsyncClient>, 
}

impl FlowManagerActor {
    pub fn new(receiver: mpsc::Receiver<FlowManagerCommand>, mqtt_client: Option<AsyncClient>) -> Self {
        Self {
            receiver,
            active_flows: HashMap::new(),
            mqtt_client
        }
    }

    pub async fn run(&mut self) {
        while let Some(cmd) = self.receiver.recv().await {
            match cmd {
                FlowManagerCommand::StartFlow { flow_id, graph, broadcast_tx } => {
                    if self.active_flows.contains_key(&flow_id) {
                        tracing::error!("Flow with ID {} is already running.", flow_id);
                        continue;
                    }

                    tracing::info!("Starting flow execution globally for flow_id: {}", flow_id);
                    let engine = Arc::new(FlowEngine::new(graph).unwrap());
                    let (controller, handle) = engine.start(broadcast_tx, self.mqtt_client.clone()).await;
                    self.active_flows.insert(flow_id, (controller, handle));
                }
                FlowManagerCommand::StopFlow { flow_id } => {
                    if let Some((controller, handle)) = self.active_flows.remove(&flow_id) {
                        tracing::info!("Stop signal sent to global flow_id: {}", flow_id);
                        controller.stop();
                    }
                }
                FlowManagerCommand::GetAllFlows { responder, pool } => {
                    let all_db_flows = db::repository::get_all_flows(&pool).unwrap_or_default();
                    let status: Vec<(i32, bool)> = all_db_flows.into_iter()
                        .map(|f| {
                            (f.id, self.active_flows.contains_key(&f.id))
                        }).collect();
                    let _ = responder.send(status);
                }
            }
        }
    }
}
