use crate::map::{geojson as map_geojson, kml as map_kml, FeatureWithVertices, MapLayer, Vertex};
use crate::{error::AppError, handler::auth::AuthUser, state::AppState};
use axum::{
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use std::sync::Arc;

const FILENAME_MAX_LEN: usize = 50;

#[derive(Deserialize)]
pub struct LayerPayload {
    pub name: String,
    pub description: Option<String>,
    pub is_visible: Option<bool>,
}

#[derive(Deserialize, Clone)]
pub struct VertexPayload {
    pub latitude: f64,
    pub longitude: f64,
    pub altitude: Option<f64>,
}

#[derive(Deserialize)]
pub struct FeaturePayload {
    pub feature_type: String,
    pub name: Option<String>,
    pub style_properties: Option<String>,
    pub vertices: Vec<VertexPayload>,
}

#[derive(Deserialize)]
pub struct UpdateFeaturePayload {
    pub name: Option<String>,
    pub style_properties: Option<String>,
    pub vertices: Option<Vec<VertexPayload>>,
}

#[derive(Deserialize)]
pub struct ExportQuery {
    pub format: Option<String>,
}

#[derive(Deserialize)]
pub struct ImportPayload {
    pub name: Option<String>,
    pub format: String,
    pub content: String,
}

fn to_vertices(payload: Vec<VertexPayload>) -> Vec<Vertex> {
    payload
        .into_iter()
        .enumerate()
        .map(|(i, v)| Vertex {
            latitude: v.latitude,
            longitude: v.longitude,
            altitude: v.altitude,
            sequence: i as i32,
        })
        .collect()
}

fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name
        .replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_")
        .chars()
        .take(FILENAME_MAX_LEN)
        .collect();
    let trimmed = cleaned.trim();
    if trimmed.is_empty() {
        "map".to_string()
    } else {
        trimmed.to_string()
    }
}

pub async fn get_layers(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Vec<MapLayer>>, AppError> {
    let layers = state.map_store.list_layers()?;
    Ok(Json(layers))
}

pub async fn create_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<LayerPayload>,
) -> Result<Json<MapLayer>, AppError> {
    let layer = state
        .map_store
        .create_layer(payload.name, payload.description, payload.is_visible.unwrap_or(true))
        .await?;
    Ok(Json(layer))
}

pub async fn get_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    if !state.map_store.layer_exists(&id) {
        return Ok((StatusCode::NOT_FOUND, "Layer not found").into_response());
    }
    let layer = state.map_store.read_layer(&id)?;
    Ok(Json(layer).into_response())
}

pub async fn update_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<String>,
    Json(payload): Json<LayerPayload>,
) -> Result<Json<MapLayer>, AppError> {
    let layer = state
        .map_store
        .update_layer(&id, payload.name, payload.description, payload.is_visible.unwrap_or(true))
        .await?;
    Ok(Json(layer))
}

pub async fn delete_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.map_store.delete_layer(&id).await?;
    Ok(Json(
        serde_json::json!({ "status": "success", "message": "Layer deleted" }),
    ))
}

pub async fn create_feature(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(layer_id): Path<String>,
    Json(payload): Json<FeaturePayload>,
) -> Result<Json<FeatureWithVertices>, AppError> {
    let feature = state
        .map_store
        .add_feature(
            &layer_id,
            payload.feature_type,
            payload.name,
            payload.style_properties,
            to_vertices(payload.vertices),
        )
        .await?;
    Ok(Json(feature))
}

pub async fn get_feature(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path((layer_id, feature_id)): Path<(String, String)>,
) -> Result<Json<FeatureWithVertices>, AppError> {
    let layer = state.map_store.read_layer(&layer_id)?;
    let feature = layer
        .features
        .into_iter()
        .find(|f| f.id == feature_id)
        .ok_or_else(|| anyhow::anyhow!("Feature not found: {}", feature_id))?;
    Ok(Json(feature))
}

pub async fn update_feature(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path((layer_id, feature_id)): Path<(String, String)>,
    Json(payload): Json<UpdateFeaturePayload>,
) -> Result<Json<FeatureWithVertices>, AppError> {
    let feature = state
        .map_store
        .update_feature(
            &layer_id,
            &feature_id,
            payload.name,
            payload.style_properties,
            payload.vertices.map(to_vertices),
        )
        .await?;
    Ok(Json(feature))
}

pub async fn delete_feature(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path((layer_id, feature_id)): Path<(String, String)>,
) -> Result<Json<serde_json::Value>, AppError> {
    state.map_store.delete_feature(&layer_id, &feature_id).await?;
    Ok(Json(
        serde_json::json!({ "status": "success", "message": "Feature deleted" }),
    ))
}

pub async fn export_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<String>,
    Query(query): Query<ExportQuery>,
) -> Result<Response, AppError> {
    if !state.map_store.layer_exists(&id) {
        return Ok((StatusCode::NOT_FOUND, "Layer not found").into_response());
    }

    let layer = state.map_store.read_layer(&id)?;
    let format = query.format.unwrap_or_else(|| "geojson".to_string());

    let (body, content_type, ext) = match format.as_str() {
        "kml" => (
            map_kml::to_kml(&layer),
            "application/vnd.google-earth.kml+xml",
            "kml",
        ),
        "geojson" => (
            state.map_store.read_raw_geojson(&id)?,
            "application/geo+json",
            "geojson",
        ),
        _ => return Ok((StatusCode::BAD_REQUEST, "Unsupported format").into_response()),
    };

    let filename = sanitize_filename(&layer.layer.name);
    let disposition = format!("attachment; filename=\"{}.{}\"", filename, ext);

    Ok((
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, content_type.to_string()),
            (header::CONTENT_DISPOSITION, disposition),
        ],
        body,
    )
        .into_response())
}

pub async fn import_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Json(payload): Json<ImportPayload>,
) -> Result<Response, AppError> {
    let parsed = match payload.format.as_str() {
        "geojson" | "json" => match serde_json::from_str(&payload.content) {
            Ok(value) => map_geojson::from_value(value, "imported"),
            Err(e) => return Ok((StatusCode::BAD_REQUEST, format!("Invalid GeoJSON: {}", e)).into_response()),
        },
        "kml" => map_kml::from_kml(&payload.content),
        _ => return Ok((StatusCode::BAD_REQUEST, "Unsupported format").into_response()),
    };

    let mut layer = match parsed {
        Ok(layer) => layer,
        Err(e) => return Ok((StatusCode::BAD_REQUEST, format!("Failed to parse file: {}", e)).into_response()),
    };

    if let Some(name) = payload.name {
        if !name.trim().is_empty() {
            layer.layer.name = name;
        }
    }

    let created = state.map_store.import_layer(layer).await?;
    Ok((StatusCode::OK, Json(created)).into_response())
}
