use crate::{
    db::{self, models::SystemConfiguration},
    flow::{
        engine::{FlowController, FlowEngine},
        types::{FlowRunContext, Graph},
        BinaryStore,
    },
    state::{DbPool, MqttMessage, StreamManager},
};
use anyhow::Result;
use chrono::Utc;
use rumqttc::AsyncClient;
use std::{collections::HashMap, sync::Arc};
use tokio::{
    sync::{broadcast, mpsc},
    task::JoinHandle,
};
use tracing::{error, info, warn};

pub enum FlowManagerCommand {
    StartFlow {
        flow_id: i32,
        graph: Graph,
        broadcast_tx: broadcast::Sender<String>,
        run_context: Option<FlowRunContext>,
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
    binary_store: BinaryStore,
    system_configs: Vec<SystemConfiguration>,
    pool: DbPool,
}

impl FlowManagerActor {
    pub fn new(
        receiver: mpsc::Receiver<FlowManagerCommand>,
        mqtt_client: Option<AsyncClient>,
        mqtt_tx: broadcast::Sender<MqttMessage>,
        stream_manager: StreamManager,
        system_configs: Vec<SystemConfiguration>,
        pool: DbPool,
    ) -> Self {
        Self {
            receiver,
            active_flows: HashMap::new(),
            mqtt_client,
            mqtt_tx,
            stream_manager,
            binary_store: BinaryStore::new(),
            system_configs,
            pool,
        }
    }

    pub async fn run(&mut self) {
        while let Some(cmd) = self.receiver.recv().await {
            match cmd {
                FlowManagerCommand::StartFlow {
                    flow_id,
                    graph,
                    broadcast_tx,
                    run_context,
                } => {
                    if self.active_flows.contains_key(&flow_id) {
                        error!("Flow with ID {} is already running.", flow_id);
                        continue;
                    }
                    info!("Starting flow execution for flow_id: {}", flow_id);

                    // Enrich system_configs with entity-based integration configs
                    let mut enriched_configs = self.system_configs.clone();
                    enrich_configs_from_entities(&self.pool, &mut enriched_configs);

                    match FlowEngine::new(
                        graph,
                        Some(self.mqtt_tx.clone()),
                        self.stream_manager.clone(),
                        self.binary_store.clone(),
                        enriched_configs,
                    ) {
                        Ok(engine) => {
                            let engine = Arc::new(engine);
                            let source_node_ids = engine.get_source_node_ids();
                            let (controller, handle, trigger_tx) = engine
                                .clone()
                                .start(
                                    broadcast_tx,
                                    self.mqtt_client.clone(),
                                    flow_id,
                                    run_context,
                                )
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

/// Enrich system_configs with values from entity-based integration configurations.
/// This allows flow nodes using placeholders like `{:ros2_websocket_url}` to resolve
/// from entity configurations when they are not present in system_configurations.
fn enrich_configs_from_entities(pool: &DbPool, configs: &mut Vec<SystemConfiguration>) {
    let now = Utc::now().naive_utc();

    // Home Assistant bridge entity → home_assistant_url, home_assistant_token
    if let Ok(Some(ha_entity)) =
        db::repository::get_entity_with_config_by_entity_id(pool, "home_assistant.bridge")
    {
        if let Some(config) = ha_entity.configuration {
            if let Some(url) = config.get("url").and_then(|v| v.as_str()) {
                if !configs.iter().any(|c| c.key == "home_assistant_url") {
                    configs.push(SystemConfiguration {
                        id: 0,
                        key: "home_assistant_url".to_string(),
                        value: url.to_string(),
                        enabled: 1,
                        description: Some("Auto-enriched from entity config".to_string()),
                        created_at: now,
                        updated_at: now,
                    });
                }
            }
            if let Some(token) = config.get("token").and_then(|v| v.as_str()) {
                if !configs.iter().any(|c| c.key == "home_assistant_token") {
                    configs.push(SystemConfiguration {
                        id: 0,
                        key: "home_assistant_token".to_string(),
                        value: token.to_string(),
                        enabled: 1,
                        description: Some("Auto-enriched from entity config".to_string()),
                        created_at: now,
                        updated_at: now,
                    });
                }
            }
        }
    } else {
        warn!("Could not look up home_assistant.bridge entity for config enrichment");
    }

    // ROS2 bridge entity → ros2_websocket_url
    if let Ok(Some(ros2_entity)) =
        db::repository::get_entity_with_config_by_entity_id(pool, "ros2.bridge")
    {
        if let Some(config) = ros2_entity.configuration {
            if let Some(ws_url) = config.get("websocket_url").and_then(|v| v.as_str()) {
                if !configs.iter().any(|c| c.key == "ros2_websocket_url") {
                    configs.push(SystemConfiguration {
                        id: 0,
                        key: "ros2_websocket_url".to_string(),
                        value: ws_url.to_string(),
                        enabled: 1,
                        description: Some("Auto-enriched from entity config".to_string()),
                        created_at: now,
                        updated_at: now,
                    });
                }
            }
        }
    } else {
        warn!("Could not look up ros2.bridge entity for config enrichment");
    }

    // RTL-SDR server entity → sdr_host, sdr_port
    if let Ok(Some(sdr_entity)) =
        db::repository::get_entity_with_config_by_entity_id(pool, "sdr.server")
    {
        if let Some(config) = sdr_entity.configuration {
            if let Some(host) = config.get("host").and_then(|v| v.as_str()) {
                if !configs.iter().any(|c| c.key == "sdr_host") {
                    configs.push(SystemConfiguration {
                        id: 0,
                        key: "sdr_host".to_string(),
                        value: host.to_string(),
                        enabled: 1,
                        description: Some("Auto-enriched from entity config".to_string()),
                        created_at: now,
                        updated_at: now,
                    });
                }
            }
            if let Some(port) = config.get("port").and_then(|v| v.as_str()) {
                if !configs.iter().any(|c| c.key == "sdr_port") {
                    configs.push(SystemConfiguration {
                        id: 0,
                        key: "sdr_port".to_string(),
                        value: port.to_string(),
                        enabled: 1,
                        description: Some("Auto-enriched from entity config".to_string()),
                        created_at: now,
                        updated_at: now,
                    });
                }
            }
        }
    } else {
        warn!("Could not look up sdr.server entity for config enrichment");
    }
}
