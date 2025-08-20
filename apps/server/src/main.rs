use anyhow::Result;
use dashmap::DashMap;
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use std::{env, sync::Arc};
use tokio::{net::UdpSocket, sync::{broadcast, RwLock}, task::JoinSet};
use tracing::{error, info, warn};
use webrtc::{
    rtp::packet::Packet,
    util::Unmarshal,
};
use dotenvy::dotenv;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter, fmt};

const LOG_FILE_PATH: &str = "log/app.log";

use crate::{ db::conn::establish_connection, initial::{create_initial_admin, create_initial_configurations}, lib::entity_map::remap_topics, routes::web_server, rtp::rtp_receiver, state::{AppState, MqttMessage, StreamInfo, StreamManager}};

mod state;
mod mqtt;
mod routes;
mod handler;
mod hash;
mod initial;
mod rtp;

pub mod db;
pub mod error;
pub mod flow;
pub mod lib;
pub mod rtsp;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("./migrations");

fn run_migrations(connection: &mut impl MigrationHarness<diesel::sqlite::Sqlite>) -> Result<()> {
    connection.run_pending_migrations(MIGRATIONS)
        .map_err(|e| anyhow::anyhow!(e))?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    let is_debug_mode = env::args().any(|arg| arg == "--debug");

    let file_appender = tracing_appender::rolling::never("log", "app.log");
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

    let pool = establish_connection();

    {
        let mut conn = pool.get().expect("Failed to get a connection from the pool");
        println!("Running database migrations...");
        run_migrations(&mut conn)?;
        println!("✅ Migrations completed successfully.");
        
        create_initial_admin(&mut conn);
        create_initial_configurations(&mut conn); 
    }
    
    let streams = Arc::new(DashMap::<u32, StreamInfo>::new());

    let (packet_tx, _) = broadcast::channel::<Packet>(1024);
    let (mqtt_tx, _) = broadcast::channel::<MqttMessage>(1024);

    let jwt_secret = dotenvy::var("JWT_SECRET")?;

    let app_state = Arc::new(AppState {
        streams: streams.clone(),
        mqtt_tx: mqtt_tx.clone(),
        jwt_secret: jwt_secret,
        pool: pool,
        topic_map: Arc::new(RwLock::new(Vec::new()))
    });

    let configs = db::repository::get_all_system_configs(&app_state.clone().pool)?;

    let mut set = JoinSet::new();


    remap_topics(axum::extract::State(app_state.clone()))
        .await;
    
    let server_task = tokio::spawn(web_server("0.0.0.0:8080".to_string(), app_state.clone()));

    
    if !is_debug_mode {
        if let Some(rtp_config) = configs.iter().find(|c| c.key == "rtp_broker_port") {
            if rtp_config.enabled == 1 {
                info!("RTP Receiver is enabled. Starting on {}.", &rtp_config.value);
                let rtp_listen_address = rtp_config.value.clone();
                set.spawn(rtp_receiver(rtp_listen_address, streams));
            } else {
                warn!("RTP Receiver is disabled by configuration.");
            }
        } else {
            warn!("RTP Receiver configuration ('rtp_broker_port') not found.");
        }

        if let Some(mqtt_config) = configs.iter().find(|c| c.key == "mqtt_broker_url") {
            if mqtt_config.enabled == 1 {
                info!("MQTT Broker is enabled. Connecting to {}.", &mqtt_config.value);
                let mqtt_broker_url = mqtt_config.value.clone();
                set.spawn(mqtt::start_event_loop(mqtt_broker_url, mqtt_tx, app_state.clone()));
            } else {
                warn!("MQTT Broker is disabled by configuration.");
            }
        } else {
            warn!("MQTT Broker configuration ('mqtt_broker_url') not found.");
        }

        let (rtsp_manager, frame_tx) = rtsp::RtspManager::new();
        let app_state_clone = app_state.clone();
        rtsp::start_rtsp_pipelines(app_state_clone, frame_tx).await;
    
    }

    info!("Server starting, press Ctrl-C to stop.");

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

    Ok(())
}

