use diesel::{r2d2::ConnectionManager, SqliteConnection};
use dotenvy::dotenv;
use std::env;

use crate::{
    db::models::{NewSystemConfiguration, NewUser, SystemConfiguration},
    hash::hash_password,
    initial::{create_initial_admin, create_initial_configurations},
    routes::web_server,
    state::{AppState, DbPool, MqttMessage},
};

pub fn establish_connection(database_url: &str) -> DbPool {
    let manager = ConnectionManager::<SqliteConnection>::new(database_url);
    r2d2::Pool::builder()
        .build(manager)
        .expect("Failed to create pool.")
}
