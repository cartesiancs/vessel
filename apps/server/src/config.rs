use config::{Config, ConfigError, File};
use rand::{distr::Alphanumeric, Rng};
use serde::{Deserialize, Serialize};
use std::{env, fs, path::Path};

const CONFIG_FILE: &str = "config.toml";

#[derive(Debug, Deserialize, Serialize)]
pub struct Settings {
    pub jwt_secret: String,
    pub listen_address: String,
    pub database_url: String,
}

impl Settings {
    pub fn new() -> Result<Self, ConfigError> {
        if cfg!(debug_assertions) {
            println!("INFO: Running in DEV mode. Loading from .env file.");
            dotenvy::dotenv().expect(".env file not found in DEV mode");

            let s = Config::builder()
                .add_source(config::Environment::default().separator("__"))
                .build()?;
            s.try_deserialize()
        } else {
            println!("INFO: Running in PROD mode. Loading from {}.", CONFIG_FILE);
            if Path::new(CONFIG_FILE).exists() {
                let s = Config::builder()
                    .add_source(File::with_name(CONFIG_FILE))
                    .build()?;
                s.try_deserialize()
            } else {
                println!(
                    "INFO: {} not found. Generating and using a new one.",
                    CONFIG_FILE
                );
                let secret: String = rand::rng()
                    .sample_iter(&Alphanumeric)
                    .take(32)
                    .map(char::from)
                    .collect();

                let default_settings = Settings {
                    jwt_secret: secret,
                    listen_address: "0.0.0.0:8080".to_string(),
                    database_url: "database.db".to_string(),
                };

                let toml_content = toml::to_string(&default_settings).unwrap();
                fs::write(CONFIG_FILE, toml_content).expect("Failed to write config file");

                Ok(default_settings)
            }
        }
    }
}
