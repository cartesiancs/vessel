use anyhow::Result;
use dashmap::DashMap;
use std::{sync::Arc};
use tokio::{net::UdpSocket, sync::{broadcast, RwLock}};
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


#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

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


    let pool = establish_connection();

    {
        let mut conn = pool.get().expect("Failed to get a connection from the pool");
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

    remap_topics(axum::extract::State(app_state.clone()))
        .await;
    
    let rtp_receiver_task = tokio::spawn(rtp_receiver("0.0.0.0:5004".to_string(), streams));
    let signal_server_task = tokio::spawn(web_server("0.0.0.0:8080".to_string(), app_state.clone()));

    let mqtt_event_loop_task = tokio::spawn(mqtt::start_event_loop("localhost:1883".to_string(), mqtt_tx, app_state.clone()));

    info!("Server starting, press Ctrl-C to stop.");
    tokio::select! {
        res = rtp_receiver_task => { if let Err(e) = res? { error!("RTP receiver failed: {}", e); } }
        res = signal_server_task => { if let Err(e) = res? { error!("Signal server failed: {}", e); } }
        res = mqtt_event_loop_task => { if let Err(e) = res? { error!("MQTT event loop failed: {}", e); } }
        _ = tokio::signal::ctrl_c() => { info!("Ctrl-C received, shutting down."); }
    }
    Ok(())
}

