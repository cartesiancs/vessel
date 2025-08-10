use anyhow::Result;
use diesel::{r2d2::ConnectionManager, Connection, ExpressionMethods, OptionalExtension, QueryDsl, RunQueryDsl, SelectableHelper, SqliteConnection};
use std::{sync::Arc};
use tokio::sync::{broadcast};
use tracing::{error, info, warn};
use webrtc::{
    rtp::packet::Packet,
    util::Unmarshal,
};
use std::env;
use dotenvy::dotenv;


use crate::{ db::models::NewUser, hash::hash_password, routes::web_server, state::{AppState, DbPool, MqttMessage}};
use crate::db::models::User;

mod state;
mod mqtt;
mod routes;
mod handler;
mod hash;

pub mod db;
pub mod error;

pub fn establish_connection() -> DbPool {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL_PATH").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<SqliteConnection>::new(database_url);
    r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool.")
}

pub fn create_initial_admin(conn: &mut SqliteConnection) {
    use crate::db::schema::users::dsl::*;

    let admin_username = "admin";

    let admin_exists = users
        .filter(username.eq(admin_username))
        .select(User::as_select())
        .first::<User>(conn)
        .optional()
        .expect("Error checking for admin user");

    if admin_exists.is_none() {
        let password = "admin"; 
   
        println!("Admin user not found. Creating...");

        match hash_password(password) {
            Ok(hashed_password) => {
                let new_admin = NewUser {
                    username: admin_username,
                    email: "admin@example.com",
                    password_hash: &hashed_password
                };

                diesel::insert_into(users)
                    .values(&new_admin)
                    .execute(conn)
                    .expect("Error creating admin user");
                
                println!("Admin user '{}' created.", admin_username);
            }
            Err(e) => eprintln!("error: {}", e),
        }

    } else {
        println!("Admin user already exists. Skipping creation.");
    }
}



#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    dotenv().ok();


    let pool = establish_connection();

    {
        let mut conn = pool.get().expect("Failed to get a connection from the pool");
        create_initial_admin(&mut conn);
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
