use std::sync::Arc;

use anyhow::Result;
use axum::{
    http::{header, Method, StatusCode, Uri},
    response::IntoResponse,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde_json::json;
use tokio::sync::watch;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use crate::{
    handler::{
        auth::auth_with_password, configurations, device_tokens, devices, entities, flows, ha, log,
        map, permissions, roles, stat, state, streams, users, ws::ws_handler,
    },
    state::AppState,
};
use rust_embed::Embed;

async fn get_server_info() -> Json<serde_json::Value> {
    Json(json!({
        "id": "vessel-server",
        "status": "success",
        "code": 200,
    }))
}

#[derive(Embed)]
#[folder = "../../apps/client/dist/"]
struct ClientAsset;

async fn static_handler(uri: Uri) -> impl IntoResponse {
    let mut path = uri.path().trim_start_matches('/').to_string();

    if path.is_empty() {
        path = "index.html".to_string();
    }

    match ClientAsset::get(&path) {
        Some(content) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
        }
        None => match ClientAsset::get("index.html") {
            Some(content) => {
                let mime = mime_guess::from_path("index.html").first_or_octet_stream();
                ([(header::CONTENT_TYPE, mime.as_ref())], content.data).into_response()
            }
            None => (StatusCode::NOT_FOUND, "404 Not Found").into_response(),
        },
    }
}

pub async fn web_server(
    addr: String,
    app_state: Arc<AppState>,
    mut shutdown_rx: watch::Receiver<()>,
) -> Result<()> {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE]);

    let api_routes = Router::new()
        .route("/auth", post(auth_with_password))
        .route(
            "/users",
            get(users::get_users_list).post(users::create_user),
        )
        .route(
            "/users/:id",
            get(users::get_user)
                .put(users::update_user)
                .delete(users::delete_user),
        )
        .route(
            "/users/:id/roles",
            get(users::get_user_roles).post(users::assign_role_to_user),
        )
        .route(
            "/users/:id/roles/:role_id",
            delete(users::remove_role_from_user),
        )
        .route("/roles", get(roles::get_roles).post(roles::create_role))
        .route(
            "/roles/:id",
            put(roles::update_role).delete(roles::delete_role),
        )
        .route(
            "/roles/:id/permissions",
            get(roles::get_role_permissions).post(roles::grant_permission_to_role),
        )
        .route(
            "/roles/:id/permissions/:permission_id",
            delete(roles::revoke_permission_from_role),
        )
        .route(
            "/permissions",
            get(permissions::get_permissions).post(permissions::create_permission),
        )
        .route(
            "/devices",
            post(devices::create_device).get(devices::get_devices),
        )
        .route(
            "/devices/:id",
            put(devices::update_device).delete(devices::delete_device),
        )
        .route("/devices/id/:device_pk_id", get(devices::get_device))
        .route(
            "/entities",
            get(entities::get_entities).post(entities::create_entity),
        )
        .route("/entities/all", get(entities::get_entities_with_states))
        .route(
            "/entities/:id",
            put(entities::update_entity).delete(entities::delete_entity),
        )
        .route(
            "/configurations",
            post(configurations::create_config).get(configurations::get_configs),
        )
        .route(
            "/configurations/:id",
            put(configurations::update_config).delete(configurations::delete_config),
        )
        .route("/streams/register", post(streams::register_stream))
        .route(
            "/devices/:id/token",
            post(device_tokens::issue_token)
                .get(device_tokens::get_token_info)
                .delete(device_tokens::revoke_token),
        )
        .route("/flows", post(flows::create_flow).get(flows::get_all_flows))
        .route(
            "/flows/:id",
            put(flows::update_flow).delete(flows::delete_flow),
        )
        .route(
            "/flows/:id/versions",
            post(flows::create_flow_version).get(flows::get_flow_versions),
        )
        .route("/stat", get(stat::get_stats))
        .route("/logs", get(log::list_log_files_handler))
        .route("/logs/:filename", get(log::get_log_by_filename_handler))
        .route("/logs/latest", get(log::get_latest_log_handler))
        .route("/map/layers", post(map::create_layer).get(map::get_layers))
        .route(
            "/map/layers/:id",
            get(map::get_layer)
                .put(map::update_layer)
                .delete(map::delete_layer),
        )
        .route("/map/features", post(map::create_feature))
        .route(
            "/map/features/:id",
            get(map::get_feature)
                .put(map::update_feature)
                .delete(map::delete_feature),
        )
        .route("/ha/states", get(ha::get_all_states))
        .route("/ha/states/:entity_id", post(ha::post_state))
        .route("/states/:entity_id", post(state::set_state));

    let app = Router::new()
        .route("/info", get(get_server_info))
        .route("/signal", get(ws_handler))
        .nest("/api", api_routes)
        .with_state(app_state)
        .layer(cors)
        .fallback(static_handler);
    info!("Signal server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(listener, app.into_make_service())
        .with_graceful_shutdown(async move {
            shutdown_rx.changed().await.ok();
            info!("Shutting down web server...");
        })
        .await?;
    Ok(())
}
