use std::sync::Arc;

use axum::{
    http::{header, HeaderValue, Method},
    routing::{get, post, put},
    Json, Router,
};
use anyhow::Result;
use serde_json::json;
use tower_http::cors::CorsLayer;
use tracing::{ info};

use crate::{handler::{
    auth::auth_with_password, configurations, device_tokens, devices, entities, flows, stat, streams, users, log, ws_handler::ws_handler
}, state::AppState};



async fn get_server_info() -> Json<serde_json::Value> {
   Json(json!({
        "id": "vessel-server",
        "status": "success",
        "code": 200,
    }))
}


pub async fn web_server(addr: String, app_state: Arc<AppState>) -> Result<()> {
    let cors = CorsLayer::new()
        .allow_origin("http://localhost:5173".parse::<HeaderValue>().unwrap())
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);

    let api_routes = Router::new()
        .route("/users", get(users::get_users_list).post(users::create_user))
        .route("/users/:id", get(users::get_user).put(users::update_user).delete(users::delete_user))
        .route("/devices", post(devices::create_device).get(devices::get_devices))
        .route("/devices/:id", put(devices::update_device).delete(devices::delete_device))
        .route("/entities", post(entities::create_entity).get(entities::get_entities))
        .route("/entities/all", get(entities::get_entities_with_states))
        .route("/entities/:id", put(entities::update_entity).delete(entities::delete_entity))
        .route("/configurations", post(configurations::create_config).get(configurations::get_configs))
        .route("/configurations/:id", put(configurations::update_config).delete(configurations::delete_config))
        .route("/streams/register", post(streams::register_stream))
        .route("/devices/:id/token", post(device_tokens::issue_token).get(device_tokens::get_token_info).delete(device_tokens::revoke_token))
        .route("/flows", post(flows::create_flow).get(flows::get_all_flows))
        .route("/flows/:id", put(flows::update_flow).delete(flows::delete_flow))
        .route("/flows/:id/versions", post(flows::create_flow_version).get(flows::get_flow_versions))
        .route("/stat", get(stat::get_stats))
        .route("/logs", get(log::get_logs_handler));

    

    let app = Router::new()
        .route("/info", get(get_server_info))
        .route("/signal", get(ws_handler))
        .route("/auth", post(auth_with_password))
        .nest("/api", api_routes)

        .with_state(app_state)
        .layer(cors);
    info!("Signal server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app.into_make_service()).await?;
    Ok(())
}