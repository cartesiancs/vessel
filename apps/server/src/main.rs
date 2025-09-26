use ::rtp::packet::Packet;
use anyhow::Result;
use dashmap::DashMap;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use rumqttc::{AsyncClient, MqttOptions};
use std::{env, sync::Arc};
use tokio::{
    sync::{broadcast, mpsc, watch, RwLock},
    task::JoinSet,
    time::Instant,
};
use tracing::{error, info, warn};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

const LOG_FILE_PATH: &str = "log/app.log";

use crate::{
    broker_rtp::rtp_receiver,
    db::conn::establish_connection,
    flow::manager_state::FlowManagerActor,
    initial_db::{
        create_hydrate_streams, create_initial_admin, create_initial_configurations,
        seed_initial_permissions,
    },
    lib::{entity_map::remap_topics, stream_checker::stream_status_checker},
    logo::print_logo,
    routes::web_server,
    state::{AppState, MediaType, MqttMessage, StreamInfo, StreamManager},
};

mod broker_mqtt;
mod broker_rtp;
mod config;
mod handler;
mod initial_db;
mod routes;
mod state;

pub mod broker_rtsp;
pub mod db;
pub mod error;
pub mod flow;
pub mod lib;
pub mod logo;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("./migrations");

fn run_migrations(connection: &mut impl MigrationHarness<diesel::sqlite::Sqlite>) -> Result<()> {
    connection
        .run_pending_migrations(MIGRATIONS)
        .map_err(|e| anyhow::anyhow!(e))?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    let settings = config::Settings::new().expect("Failed to load configuration");

    let is_debug_mode = env::args().any(|arg| arg == "--debug");

    let file_appender = tracing_appender::rolling::daily("log", "app.log");
    let (non_blocking_writer, _guard) = tracing_appender::non_blocking(file_appender);

    let file_layer = fmt::layer()
        .with_writer(non_blocking_writer)
        .with_ansi(false);

    let console_layer = fmt::layer();

    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with(file_layer)
        .with(console_layer)
        .init();

    if is_debug_mode {
        warn!("APPLICATION IS RUNNING IN DEBUG MODE. ONLY THE WEB SERVER WILL BE ACTIVATED.");
    }

    let streams: Arc<DashMap<u32, StreamInfo>> = Arc::new(DashMap::<u32, StreamInfo>::new());

    let pool = establish_connection(&settings.database_url);

    {
        let mut conn = pool
            .get()
            .expect("Failed to get a connection from the pool");
        info!("Running database migrations...");
        run_migrations(&mut conn)?;
        info!("Migrations completed successfully.");

        create_initial_admin(&mut conn);
        create_initial_configurations(&mut conn);
        seed_initial_permissions(&mut conn);
        create_hydrate_streams(&pool, &streams);
    }

    let (mqtt_tx, _) = broadcast::channel::<MqttMessage>(1024);
    let (flow_manager_tx, flow_manager_rx) = mpsc::channel(100);
    let (broadcast_tx, _) = broadcast::channel(1024);
    let (shutdown_tx, shutdown_rx) = watch::channel(());

    let jwt_secret = settings.jwt_secret.clone();
    let configs = db::repository::get_all_system_configs(&pool)?;

    let app_state = Arc::new(AppState {
        streams: streams.clone(),
        mqtt_tx: mqtt_tx.clone(),
        jwt_secret: jwt_secret,
        pool: pool,
        topic_map: Arc::new(RwLock::new(Vec::new())),
        flow_manager_tx,
        broadcast_tx,
        system_configs: configs.clone(),
    });

    let mut set = JoinSet::new();

    remap_topics(axum::extract::State(app_state.clone())).await;

    let server_task = tokio::spawn(web_server(
        settings.listen_address,
        app_state.clone(),
        shutdown_rx.clone(),
    ));

    print_logo();

    let mut mqtt_client_for_flow: Option<AsyncClient> = None;

    if !is_debug_mode {
        if let Some(rtp_config) = configs.iter().find(|c| c.key == "rtp_broker_port") {
            if rtp_config.enabled == 1 {
                info!(
                    "RTP Receiver is enabled. Starting on {}.",
                    &rtp_config.value
                );
                let rtp_listen_address = rtp_config.value.clone();
                set.spawn(rtp_receiver(rtp_listen_address, streams.clone()));
            } else {
                warn!("RTP Receiver is disabled by configuration.");
            }
        } else {
            warn!("RTP Receiver configuration ('rtp_broker_port') not found.");
        }

        if let Some(mqtt_config) = configs.iter().find(|c| c.key == "mqtt_broker_url") {
            if mqtt_config.enabled == 1 {
                info!(
                    "MQTT Broker is enabled. Connecting to {}.",
                    &mqtt_config.value
                );
                let mqtt_broker_url = mqtt_config.value.clone();
                let parts: Vec<&str> = mqtt_broker_url.split(':').collect();
                if parts.len() != 2 {
                    return Err(anyhow::anyhow!(
                        "Invalid broker address format. Expected 'host:port', got '{}'",
                        mqtt_broker_url
                    ));
                }
                let host = parts[0];
                let port: u16 = parts[1].parse()?;

                let mut mqttoptions = MqttOptions::new("rust-internal-client", host, port);
                mqttoptions.set_keep_alive(std::time::Duration::from_secs(5));

                let (client, eventloop) = AsyncClient::new(mqttoptions, 10);

                mqtt_client_for_flow = Some(client.clone());
                let mqtt_tx_clone = mqtt_tx.clone();

                set.spawn(broker_mqtt::start_event_loop(
                    client,
                    eventloop,
                    mqtt_tx_clone,
                    app_state.clone(),
                ));
            } else {
                warn!("MQTT Broker is disabled by configuration.");
            }
        } else {
            warn!("MQTT Broker configuration ('mqtt_broker_url') not found.");
        }

        let app_state_for_checker = app_state.clone();
        set.spawn(stream_status_checker(
            app_state_for_checker,
            shutdown_rx.clone(),
        ));

        let app_state_clone = app_state.clone();
        set.spawn(broker_rtsp::start_rtsp_pipelines(
            app_state_clone,
            shutdown_rx.clone(),
        ));
    }

    let mut flow_manager = FlowManagerActor::new(
        flow_manager_rx,
        mqtt_client_for_flow,
        mqtt_tx.clone(),
        streams.clone(),
        configs.clone(),
    );
    tokio::spawn(async move {
        flow_manager.run().await;
    });

    info!("Server starting, press Ctrl-C to stop.");

    tokio::select! {
        _ = tokio::signal::ctrl_c() => {
            info!("Ctrl-C received, initiating shutdown...");
        }
        Some(res) = set.join_next() => {
             match res {
                Ok(Ok(())) => info!("A background task finished gracefully."),
                Ok(Err(e)) => error!("A background task finished with an error: {}", e),
                Ok(Err(e)) => error!("A background task failed to join: {}", e),
                Err(e) => error!("A background task panicked: {}", e),
            }
        }
    }

    tokio::select! {
        res = set.join_next(), if !set.is_empty() => {
            if let Some(Ok(Err(e))) = res {
                error!("A task exited with an error: {}", e);
            }
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Ctrl-C received, shutting down.");
        }
    }

    set.abort_all();
    shutdown_tx.send(()).ok();

    info!("Waiting for all tasks to complete...");
    while let Some(res) = set.join_next().await {
        match res {
            Ok(Ok(())) => {}
            Ok(Err(e)) => error!("A task shut down with an error: {}", e),
            Ok(Err(e)) => error!("A task failed to join during shutdown: {}", e),
            Err(e) => error!("A task panicked during shutdown: {}", e),
        }
    }
    info!("All tasks have been shut down.");

    Ok(())
}
