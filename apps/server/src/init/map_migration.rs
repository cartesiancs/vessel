//! One-time migration of legacy DB-backed map data into file-based GeoJSON.
//!
//! Runs at boot, guarded by a sentinel file. Reads the legacy `map_layers` /
//! `map_features` / `map_vertices` tables via raw SQL (so it stays independent of
//! the removed Diesel models), writes one `.geojson` per layer, then drops the
//! tables. Safe and idempotent: fresh installs see empty tables, drop them, and
//! write the sentinel.

use anyhow::Result;
use diesel::prelude::*;
use diesel::sql_query;
use diesel::sql_types::{BigInt, Float, Integer, Nullable, Text};
use uuid::Uuid;

use crate::map::{FeatureWithVertices, LayerWithFeatures, MapLayer, MapStore, Vertex};
use crate::state::DbPool;

#[derive(QueryableByName)]
struct CountRow {
    #[diesel(sql_type = BigInt)]
    cnt: i64,
}

#[derive(QueryableByName)]
struct LayerRow {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Text)]
    name: String,
    #[diesel(sql_type = Nullable<Text>)]
    description: Option<String>,
    #[diesel(sql_type = Integer)]
    is_visible: i32,
    #[diesel(sql_type = Text)]
    created_at: String,
    #[diesel(sql_type = Text)]
    updated_at: String,
}

#[derive(QueryableByName)]
struct FeatureRow {
    #[diesel(sql_type = Integer)]
    id: i32,
    #[diesel(sql_type = Text)]
    feature_type: String,
    #[diesel(sql_type = Nullable<Text>)]
    name: Option<String>,
    #[diesel(sql_type = Nullable<Text>)]
    style_properties: Option<String>,
}

#[derive(QueryableByName)]
struct VertexRow {
    #[diesel(sql_type = Float)]
    latitude: f32,
    #[diesel(sql_type = Float)]
    longitude: f32,
    #[diesel(sql_type = Nullable<Float>)]
    altitude: Option<f32>,
    #[diesel(sql_type = Integer)]
    sequence: i32,
}

pub fn migrate_map_db_to_files(pool: &DbPool, store: &MapStore) -> Result<()> {
    let sentinel = store.dir().join(".db-migrated");
    if sentinel.exists() {
        return Ok(());
    }

    let mut conn = pool.get()?;

    let table_count: i64 = sql_query(
        "SELECT COUNT(*) AS cnt FROM sqlite_master WHERE type='table' AND name='map_layers'",
    )
    .get_result::<CountRow>(&mut conn)?
    .cnt;

    if table_count == 0 {
        std::fs::write(&sentinel, b"")?;
        return Ok(());
    }

    let layers: Vec<LayerRow> = sql_query(
        "SELECT id, name, description, is_visible, \
         CAST(created_at AS TEXT) AS created_at, CAST(updated_at AS TEXT) AS updated_at \
         FROM map_layers",
    )
    .load(&mut conn)?;

    let mut migrated = 0usize;
    for lr in &layers {
        let features: Vec<FeatureRow> = sql_query(
            "SELECT id, feature_type, name, style_properties FROM map_features WHERE layer_id = ?",
        )
        .bind::<Integer, _>(lr.id)
        .load(&mut conn)?;

        let layer_id = Uuid::new_v4().to_string();
        let mut feature_list = Vec::with_capacity(features.len());
        for fr in &features {
            let vertex_rows: Vec<VertexRow> = sql_query(
                "SELECT latitude, longitude, altitude, sequence \
                 FROM map_vertices WHERE feature_id = ? ORDER BY sequence",
            )
            .bind::<Integer, _>(fr.id)
            .load(&mut conn)?;

            let vertices = vertex_rows
                .iter()
                .map(|v| Vertex {
                    latitude: v.latitude as f64,
                    longitude: v.longitude as f64,
                    altitude: v.altitude.map(|a| a as f64),
                    sequence: v.sequence,
                })
                .collect();

            feature_list.push(FeatureWithVertices {
                id: Uuid::new_v4().to_string(),
                layer_id: layer_id.clone(),
                feature_type: fr.feature_type.clone(),
                name: fr.name.clone(),
                style_properties: fr.style_properties.clone(),
                vertices,
            });
        }

        let lw = LayerWithFeatures {
            layer: MapLayer {
                id: layer_id,
                name: lr.name.clone(),
                description: lr.description.clone(),
                is_visible: lr.is_visible,
                created_at: lr.created_at.clone(),
                updated_at: lr.updated_at.clone(),
            },
            features: feature_list,
        };
        store.save_layer(&lw)?;
        migrated += 1;
    }

    sql_query("DROP TABLE IF EXISTS map_vertices").execute(&mut conn)?;
    sql_query("DROP TABLE IF EXISTS map_features").execute(&mut conn)?;
    sql_query("DROP TABLE IF EXISTS map_layers").execute(&mut conn)?;

    std::fs::write(&sentinel, b"")?;
    tracing::info!("Migrated {} map layer(s) from DB to files", migrated);
    Ok(())
}
