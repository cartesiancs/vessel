//! File-based map storage. Each layer is a standard GeoJSON `FeatureCollection`
//! persisted under `storage/maps/<uuid>.geojson`; that file is the source of truth.
//! The wrapper types below mirror the legacy DB-backed API shapes so the client
//! rendering/editing code stays unchanged (only IDs are now strings).

pub mod geojson;
pub mod kml;
mod store;

pub use store::MapStore;

use serde::{Deserialize, Serialize};

/// Default feature color, matching the client default in `FeatureRenderer`.
pub const DEFAULT_FEATURE_COLOR: &str = "#6ec7f0";

/// Epsilon for comparing coordinates (no float `==`, per CODE_RULE).
const COORD_EPSILON: f64 = 1e-9;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MapLayer {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub is_visible: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Vertex {
    pub latitude: f64,
    pub longitude: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub altitude: Option<f64>,
    pub sequence: i32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FeatureWithVertices {
    pub id: String,
    pub layer_id: String,
    pub feature_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style_properties: Option<String>,
    pub vertices: Vec<Vertex>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LayerWithFeatures {
    #[serde(flatten)]
    pub layer: MapLayer,
    pub features: Vec<FeatureWithVertices>,
}

/// True when two vertices share the same position within `COORD_EPSILON`.
fn same_position(a: &Vertex, b: &Vertex) -> bool {
    (a.latitude - b.latitude).abs() < COORD_EPSILON
        && (a.longitude - b.longitude).abs() < COORD_EPSILON
}
