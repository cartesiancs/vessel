use diesel::{r2d2::ConnectionManager, SqliteConnection};
use std::env;
use dotenvy::dotenv;


use crate::{ db::models::{NewSystemConfiguration, NewUser, SystemConfiguration}, hash::hash_password, initial::{create_initial_admin, create_initial_configurations}, routes::web_server, state::{AppState, DbPool, MqttMessage}};


pub fn establish_connection() -> DbPool {
    dotenv().ok();

    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let manager = ConnectionManager::<SqliteConnection>::new(database_url);
    r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool.")
}

