use diesel::{ ExpressionMethods, OptionalExtension, QueryDsl, RunQueryDsl, SelectableHelper, SqliteConnection};
use tracing::info;


use crate::{ db::models::{NewSystemConfiguration, NewUser, SystemConfiguration}, hash::hash_password};
use crate::db::models::User;


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
   
        info!("Admin user not found. Creating...");

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
                
                info!("Admin user '{}' created.", admin_username);
            }
            Err(e) => eprintln!("error: {}", e),
        }

    } else {
        info!("Admin user already exists. Skipping creation.");
    }
}


pub fn create_initial_configurations(conn: &mut SqliteConnection) {
    use crate::db::schema::system_configurations::{dsl::{system_configurations, key}};

    let default_configs = vec![
        (
            "mqtt_broker_url",
            "localhost:1883",
            "Default MQTT Broker URL. Format: host:port",
        ),
        (
            "rtp_broker_port",
            "0.0.0.0:5004",
            "RTP port",
        ),
        (
            "turn_server_config",
            r#"{ "urls": "turn:turn.example.com:3478", "username": "user", "credential": "pass" }"#,
            "Default WebRTC TURN Server configuration (JSON format)",
        ),
    ];

    for (k, v, d) in default_configs {
        let config_exists = system_configurations
            .filter(key.eq(k))
            .select(SystemConfiguration::as_select())
            .first::<SystemConfiguration>(conn)
            .optional()
            .expect("Error checking for system configuration");

        if config_exists.is_none() {
            info!("Configuration '{}' not found. Creating...", k);
            let new_config = NewSystemConfiguration {
                key: k,
                value: v,
                enabled: Some(0), 
                description: Some(d),
            };

            diesel::insert_into(system_configurations)
                .values(&new_config)
                .execute(conn)
                .expect("Error creating system configuration");
            
            info!("Configuration '{}' created.", k);
        } else {
            info!("Configuration '{}' already exists. Skipping creation.", k);
        }
    }
}

