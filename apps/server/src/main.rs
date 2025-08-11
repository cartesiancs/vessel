use anyhow::Result;
use std::{sync::Arc};
use tokio::sync::{broadcast};
use tracing::{error, info, warn};
use webrtc::{
    rtp::packet::Packet,
    util::Unmarshal,
};
use dotenvy::dotenv;


use crate::{ db::{conn::establish_connection}, initial::{create_initial_admin, create_initial_configurations}, routes::web_server, state::{AppState, MqttMessage}};

mod state;
mod mqtt;
mod routes;
mod handler;
mod hash;
mod initial;

pub mod db;
pub mod error;


#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    dotenv().ok();


    let pool = establish_connection();

    {
        let mut conn = pool.get().expect("Failed to get a connection from the pool");
        create_initial_admin(&mut conn);
        create_initial_configurations(&mut conn); 
    }
    

    let (packet_tx, _) = broadcast::channel::<Packet>(1024);
    let (mqtt_tx, _) = broadcast::channel::<MqttMessage>(1024);

    let jwt_secret = dotenvy::var("JWT_SECRET")?;

    let app_state = Arc::new(AppState {
        packet_tx: packet_tx.clone(),
        mqtt_tx: mqtt_tx.clone(),
        jwt_secret: jwt_secret,
        pool: pool,
    });
    
    let rtp_receiver_task = tokio::spawn(rtp_receiver("0.0.0.0:5004".to_string(), packet_tx));
    let signal_server_task = tokio::spawn(web_server("0.0.0.0:8080".to_string(), app_state));

    let mqtt_event_loop_task = tokio::spawn(mqtt::start_event_loop("localhost:1883".to_string(), mqtt_tx));

    info!("Server starting, press Ctrl-C to stop.");
    tokio::select! {
        res = rtp_receiver_task => { if let Err(e) = res? { error!("RTP receiver failed: {}", e); } }
        res = signal_server_task => { if let Err(e) = res? { error!("Signal server failed: {}", e); } }
        res = mqtt_event_loop_task => { if let Err(e) = res? { error!("MQTT event loop failed: {}", e); } }
        _ = tokio::signal::ctrl_c() => { info!("Ctrl-C received, shutting down."); }
    }
    Ok(())
}

async fn rtp_receiver(addr: String, packet_tx: broadcast::Sender<Packet>) -> Result<()> {
    let sock = tokio::net::UdpSocket::bind(&addr).await?;
    let mut buf = vec![0u8; 4096];
    loop {
        let (n, _) = sock.recv_from(&mut buf).await?;
        if let Ok(p) = Packet::unmarshal(&mut &buf[..n]) {
            if packet_tx.send(p).is_err() { warn!("rtpreceiver ▶ receiver lagging, packet dropped"); }
        }
    }
}
