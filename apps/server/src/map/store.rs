//! File-backed map store. Layer files live in `storage/maps/<uuid>.geojson`.
//! Mutating operations are serialized through an async mutex (read-modify-write
//! of a whole layer file).

use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use std::path::{Path, PathBuf};
use tokio::sync::Mutex;
use uuid::Uuid;

use super::{geojson, FeatureWithVertices, LayerWithFeatures, MapLayer, Vertex};

pub struct MapStore {
    dir: PathBuf,
    write_lock: Mutex<()>,
}

impl MapStore {
    pub fn new() -> Result<Self> {
        let dir = std::env::current_dir()?.join("storage").join("maps");
        std::fs::create_dir_all(&dir)
            .with_context(|| format!("Failed to create maps directory {:?}", dir))?;
        Ok(Self {
            dir,
            write_lock: Mutex::new(()),
        })
    }

    pub fn dir(&self) -> &Path {
        &self.dir
    }

    /// Resolve a layer id (must be a valid UUID) to its file path. Validating as
    /// a UUID prevents any path traversal via the id.
    fn layer_path(&self, id: &str) -> Result<PathBuf> {
        let uuid = Uuid::parse_str(id).map_err(|_| anyhow!("Invalid layer id"))?;
        Ok(self.dir.join(format!("{}.geojson", uuid)))
    }

    pub fn layer_exists(&self, id: &str) -> bool {
        self.layer_path(id).map(|p| p.is_file()).unwrap_or(false)
    }

    pub fn list_layers(&self) -> Result<Vec<MapLayer>> {
        let mut layers = Vec::new();
        for entry in std::fs::read_dir(&self.dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("geojson") {
                continue;
            }
            let stem = match path.file_stem().and_then(|s| s.to_str()) {
                Some(s) if Uuid::parse_str(s).is_ok() => s.to_string(),
                _ => continue,
            };
            match std::fs::read_to_string(&path) {
                Ok(content) => match geojson::parse_layer(&content, &stem) {
                    Ok(lw) => layers.push(lw.layer),
                    Err(e) => tracing::warn!("Skipping invalid map file {:?}: {}", path, e),
                },
                Err(e) => tracing::warn!("Failed to read map file {:?}: {}", path, e),
            }
        }
        layers.sort_by(|a, b| a.created_at.cmp(&b.created_at));
        Ok(layers)
    }

    pub fn read_layer(&self, id: &str) -> Result<LayerWithFeatures> {
        let path = self.layer_path(id)?;
        let content = std::fs::read_to_string(&path)
            .with_context(|| format!("Layer not found: {}", id))?;
        geojson::parse_layer(&content, id)
    }

    pub fn read_raw_geojson(&self, id: &str) -> Result<String> {
        let path = self.layer_path(id)?;
        std::fs::read_to_string(&path).with_context(|| format!("Layer not found: {}", id))
    }

    /// Serialize and write a layer to disk. Used internally and by the boot
    /// migration; callers must hold `write_lock` for concurrent mutations.
    pub fn save_layer(&self, layer: &LayerWithFeatures) -> Result<()> {
        let path = self.layer_path(&layer.layer.id)?;
        let value = geojson::to_geojson(layer);
        let content = serde_json::to_string_pretty(&value)?;
        std::fs::write(&path, content)
            .with_context(|| format!("Failed to write layer {}", layer.layer.id))?;
        Ok(())
    }

    pub async fn create_layer(
        &self,
        name: String,
        description: Option<String>,
        is_visible: bool,
    ) -> Result<MapLayer> {
        let _guard = self.write_lock.lock().await;
        let now = Utc::now().to_rfc3339();
        let layer = MapLayer {
            id: Uuid::new_v4().to_string(),
            name,
            description,
            is_visible: if is_visible { 1 } else { 0 },
            created_at: now.clone(),
            updated_at: now,
        };
        let lw = LayerWithFeatures {
            layer: layer.clone(),
            features: Vec::new(),
        };
        self.save_layer(&lw)?;
        Ok(layer)
    }

    pub async fn update_layer(
        &self,
        id: &str,
        name: String,
        description: Option<String>,
        is_visible: bool,
    ) -> Result<MapLayer> {
        let _guard = self.write_lock.lock().await;
        let mut lw = self.read_layer(id)?;
        lw.layer.name = name;
        lw.layer.description = description;
        lw.layer.is_visible = if is_visible { 1 } else { 0 };
        lw.layer.updated_at = Utc::now().to_rfc3339();
        self.save_layer(&lw)?;
        Ok(lw.layer)
    }

    pub async fn delete_layer(&self, id: &str) -> Result<()> {
        let _guard = self.write_lock.lock().await;
        let path = self.layer_path(id)?;
        std::fs::remove_file(&path).with_context(|| format!("Layer not found: {}", id))?;
        Ok(())
    }

    pub async fn add_feature(
        &self,
        layer_id: &str,
        feature_type: String,
        name: Option<String>,
        style_properties: Option<String>,
        vertices: Vec<Vertex>,
    ) -> Result<FeatureWithVertices> {
        let _guard = self.write_lock.lock().await;
        let mut lw = self.read_layer(layer_id)?;
        let feature = FeatureWithVertices {
            id: Uuid::new_v4().to_string(),
            layer_id: layer_id.to_string(),
            feature_type,
            name,
            style_properties,
            vertices,
        };
        lw.features.push(feature.clone());
        lw.layer.updated_at = Utc::now().to_rfc3339();
        self.save_layer(&lw)?;
        Ok(feature)
    }

    pub async fn update_feature(
        &self,
        layer_id: &str,
        feature_id: &str,
        name: Option<String>,
        style_properties: Option<String>,
        vertices: Option<Vec<Vertex>>,
    ) -> Result<FeatureWithVertices> {
        let _guard = self.write_lock.lock().await;
        let mut lw = self.read_layer(layer_id)?;
        let feature = lw
            .features
            .iter_mut()
            .find(|f| f.id == feature_id)
            .ok_or_else(|| anyhow!("Feature not found: {}", feature_id))?;
        // `None` means "leave unchanged", matching the legacy AsChangeset behavior.
        if name.is_some() {
            feature.name = name;
        }
        if style_properties.is_some() {
            feature.style_properties = style_properties;
        }
        if let Some(v) = vertices {
            feature.vertices = v;
        }
        let updated = feature.clone();
        lw.layer.updated_at = Utc::now().to_rfc3339();
        self.save_layer(&lw)?;
        Ok(updated)
    }

    pub async fn delete_feature(&self, layer_id: &str, feature_id: &str) -> Result<()> {
        let _guard = self.write_lock.lock().await;
        let mut lw = self.read_layer(layer_id)?;
        let before = lw.features.len();
        lw.features.retain(|f| f.id != feature_id);
        if lw.features.len() == before {
            return Err(anyhow!("Feature not found: {}", feature_id));
        }
        lw.layer.updated_at = Utc::now().to_rfc3339();
        self.save_layer(&lw)?;
        Ok(())
    }

    /// Persist an externally-parsed layer (GeoJSON/KML import) under a fresh id,
    /// regenerating all feature ids.
    pub async fn import_layer(&self, mut lw: LayerWithFeatures) -> Result<MapLayer> {
        let _guard = self.write_lock.lock().await;
        let id = Uuid::new_v4().to_string();
        let now = Utc::now().to_rfc3339();
        lw.layer.id = id.clone();
        lw.layer.created_at = now.clone();
        lw.layer.updated_at = now;
        for f in lw.features.iter_mut() {
            f.id = Uuid::new_v4().to_string();
            f.layer_id = id.clone();
        }
        self.save_layer(&lw)?;
        Ok(lw.layer)
    }
}
