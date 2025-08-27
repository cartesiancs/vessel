use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use crate::{db, error::AppError, handler::auth::AuthUser, state::AppState};
use crate::db::models::{
    NewMapLayer, UpdateMapLayer, MapLayer, LayerWithFeatures,
    NewMapFeature, UpdateMapFeature, NewMapVertex, MapFeature, FeatureWithVertices
};

#[derive(Deserialize)]
pub struct LayerPayload {
    pub name: String,
    pub description: Option<String>,
    pub is_visible: Option<bool>,
}

#[derive(Deserialize, Clone)]
pub struct VertexPayload {
    pub latitude: f32,
    pub longitude: f32,
    pub altitude: Option<f32>,
}

#[derive(Deserialize)]
pub struct FeaturePayload {
    pub layer_id: i32,
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

pub async fn create_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(user): AuthUser,
    Json(payload): Json<LayerPayload>,
) -> Result<Json<MapLayer>, AppError> {
    let new_layer = NewMapLayer {
        name: &payload.name,
        description: payload.description.as_deref(),
        owner_user_id: user.id,
        is_visible: Some(payload.is_visible.unwrap_or(true) as i32),
    };
    let layer = db::repository::create_map_layer(&state.pool, new_layer)?;
    Ok(Json(layer))
}

pub async fn get_layers(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
) -> Result<Json<Vec<MapLayer>>, AppError> {
    let layers = db::repository::get_all_map_layers(&state.pool)?;
    Ok(Json(layers))
}

pub async fn get_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
) -> Result<Json<LayerWithFeatures>, AppError> {
    let layer_with_features = db::repository::get_map_layer_with_features(&state.pool, id)?;
    Ok(Json(layer_with_features))
}

pub async fn update_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
    Json(payload): Json<LayerPayload>,
) -> Result<Json<MapLayer>, AppError> {
    let update_data = UpdateMapLayer {
        name: Some(payload.name),
        description: payload.description,
        is_visible: Some(payload.is_visible.unwrap_or(true) as i32),
    };
    let layer = db::repository::update_map_layer(&state.pool, id, &update_data)?;
    Ok(Json(layer))
}

pub async fn delete_layer(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    db::repository::delete_map_layer(&state.pool, id)?;
    Ok(Json(json!({ "status": "success", "message": "Layer deleted" })))
}

pub async fn create_feature(
    State(state): State<Arc<AppState>>,
    AuthUser(user): AuthUser,
    Json(payload): Json<FeaturePayload>,
) -> Result<Json<MapFeature>, AppError> {
    let new_feature = NewMapFeature {
        layer_id: payload.layer_id,
        feature_type: &payload.feature_type,
        name: payload.name.as_deref(),
        style_properties: payload.style_properties.as_deref(),
        created_by_user_id: user.id,
    };

    let new_vertices = payload.vertices.into_iter().enumerate().map(|(i, v)| NewMapVertex {
        feature_id: 0,
        latitude: v.latitude,
        longitude: v.longitude,
        altitude: v.altitude,
        sequence: i as i32,
    }).collect();

    let feature = db::repository::create_map_feature(&state.pool, new_feature, new_vertices)?;
    Ok(Json(feature))
}

pub async fn get_feature(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
    AuthUser(_user): AuthUser,
) -> Result<Json<FeatureWithVertices>, AppError> {
    let feature = db::repository::get_map_feature_with_vertices(&state.pool, id)?;
    Ok(Json(feature))
}

pub async fn update_feature(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
    Json(payload): Json<UpdateFeaturePayload>,
) -> Result<Json<MapFeature>, AppError> {
    let update_data = UpdateMapFeature {
        name: payload.name,
        style_properties: payload.style_properties,
    };
    
    let new_vertices = payload.vertices.map(|vertices| {
        vertices.into_iter().enumerate().map(|(i, v)| NewMapVertex {
            feature_id: 0,
            latitude: v.latitude,
            longitude: v.longitude,
            altitude: v.altitude,
            sequence: i as i32,
        }).collect()
    });

    let feature = db::repository::update_map_feature(&state.pool, id, &update_data, new_vertices)?;
    Ok(Json(feature))
}

pub async fn delete_feature(
    State(state): State<Arc<AppState>>,
    AuthUser(_user): AuthUser,
    Path(id): Path<i32>,
) -> Result<Json<Value>, AppError> {
    db::repository::delete_map_feature(&state.pool, id)?;
    Ok(Json(json!({ "status": "success", "message": "Feature deleted" })))
}