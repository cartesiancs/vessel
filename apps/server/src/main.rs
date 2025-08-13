use anyhow::Result;
use dashmap::DashMap;
use tokio_stream::StreamMap;
use std::{sync::Arc};
use tokio::{net::UdpSocket, sync::broadcast};
use tracing::{error, info, warn};
use webrtc::{
    rtp::packet::Packet,
    util::Unmarshal,
};
use dotenvy::dotenv;


use crate::{ db::conn::establish_connection, initial::{create_initial_admin, create_initial_configurations}, routes::web_server, state::{AppState, MqttMessage, StreamInfo, StreamManager}};

mod state;
mod mqtt;
mod routes;
mod handler;
mod hash;
mod initial;

pub mod db;
pub mod error;
pub mod flow;
pub mod lib;


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
    
    let streams = Arc::new(DashMap::<u32, StreamInfo>::new());

    let (packet_tx, _) = broadcast::channel::<Packet>(1024);
    let (mqtt_tx, _) = broadcast::channel::<MqttMessage>(1024);

    let jwt_secret = dotenvy::var("JWT_SECRET")?;

    let app_state = Arc::new(AppState {
        streams: streams.clone(),
        mqtt_tx: mqtt_tx.clone(),
        jwt_secret: jwt_secret,
        pool: pool,
    });
    
    let rtp_receiver_task = tokio::spawn(rtp_receiver("0.0.0.0:5004".to_string(), streams));
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

pub async fn rtp_receiver(addr: String, stream_manager: StreamManager) -> Result<()> {
    let sock = UdpSocket::bind(&addr).await?;
    println!("RTP Demultiplexer listening on {}", addr);

    let mut buf = vec![0u8; 4096];

    loop {
        let (n, from) = match sock.recv_from(&mut buf).await {
            Ok(result) => result,
            Err(e) => {
                warn!("UDP recv_from failed: {}", e);
                continue;
            }
        };

        match Packet::unmarshal(&mut &buf[..n]) {
            Ok(packet) => {
                let ssrc = packet.header.ssrc;
            
                if let Some(stream_info) = stream_manager.get(&ssrc) {
      
                    if stream_info.value().packet_tx.send(packet).is_err() {
                        warn!(
                            "RTP packet for SSRC {} dropped, no active subscribers on topic '{}'.",
                            ssrc,
                            stream_info.value().topic
                        );
                    }
                } else {
                    warn!("Received packet from {} with unknown SSRC: {}", from, ssrc);
                }
            }
            Err(e) => {
                warn!("Failed to unmarshal RTP packet from {}: {}", from, e);
            }
        }
    }
}