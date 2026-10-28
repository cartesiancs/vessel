//! GeoJSON ⇄ wrapper-type conversion. The on-disk format is a standard
//! `FeatureCollection`; layer metadata lives in a foreign `properties` member so
//! externally-authored files still import cleanly.

use anyhow::{anyhow, Result};
use serde_json::{json, Map, Value};

use super::{
    same_position, FeatureWithVertices, LayerWithFeatures, MapLayer, Vertex, DEFAULT_FEATURE_COLOR,
};

pub fn to_geojson(layer: &LayerWithFeatures) -> Value {
    let features: Vec<Value> = layer.features.iter().map(feature_to_geojson).collect();
    json!({
        "type": "FeatureCollection",
        "properties": {
            "name": layer.layer.name,
            "description": layer.layer.description,
            "visible": layer.layer.is_visible != 0,
            "created_at": layer.layer.created_at,
            "updated_at": layer.layer.updated_at,
        },
        "features": features,
    })
}

fn coord(v: &Vertex) -> Value {
    match v.altitude {
        Some(alt) => json!([v.longitude, v.latitude, alt]),
        None => json!([v.longitude, v.latitude]),
    }
}

fn feature_to_geojson(f: &FeatureWithVertices) -> Value {
    let geometry = match f.feature_type.as_str() {
        "POINT" => {
            let c = f.vertices.first().map(coord).unwrap_or_else(|| json!([0.0, 0.0]));
            json!({ "type": "Point", "coordinates": c })
        }
        "LINE" => {
            let coords: Vec<Value> = f.vertices.iter().map(coord).collect();
            json!({ "type": "LineString", "coordinates": coords })
        }
        "POLYGON" => {
            let mut coords: Vec<Value> = f.vertices.iter().map(coord).collect();
            // GeoJSON polygons must repeat the first coordinate to close the ring.
            if let (Some(first), Some(last)) = (f.vertices.first(), f.vertices.last()) {
                if !same_position(first, last) {
                    coords.push(coord(first));
                }
            }
            json!({ "type": "Polygon", "coordinates": [coords] })
        }
        _ => json!({ "type": "Point", "coordinates": [0.0, 0.0] }),
    };

    let style: Value = f
        .style_properties
        .as_ref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_else(|| json!({ "color": DEFAULT_FEATURE_COLOR }));

    let mut props = Map::new();
    if let Some(name) = &f.name {
        props.insert("name".into(), json!(name));
    }
    props.insert("style".into(), style);

    json!({
        "type": "Feature",
        "id": f.id,
        "geometry": geometry,
        "properties": Value::Object(props),
    })
}

/// Parse a `.geojson` file (or imported content) into the wrapper types.
/// `id` is used as the layer id; for imports it is replaced later.
pub fn parse_layer(content: &str, id: &str) -> Result<LayerWithFeatures> {
    let value: Value = serde_json::from_str(content)?;
    from_value(value, id)
}

pub fn from_value(value: Value, id: &str) -> Result<LayerWithFeatures> {
    if value.get("type").and_then(|t| t.as_str()) != Some("FeatureCollection") {
        return Err(anyhow!("Not a GeoJSON FeatureCollection"));
    }

    let props = value.get("properties");
    let name = props
        .and_then(|p| p.get("name"))
        .and_then(|v| v.as_str())
        .unwrap_or("Imported Layer")
        .to_string();
    let description = props
        .and_then(|p| p.get("description"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let visible = props
        .and_then(|p| p.get("visible"))
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let created_at = props
        .and_then(|p| p.get("created_at"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let updated_at = props
        .and_then(|p| p.get("updated_at"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let mut features = Vec::new();
    if let Some(arr) = value.get("features").and_then(|f| f.as_array()) {
        for (idx, fj) in arr.iter().enumerate() {
            if let Some(f) = parse_feature(fj, id, idx) {
                features.push(f);
            }
        }
    }

    Ok(LayerWithFeatures {
        layer: MapLayer {
            id: id.to_string(),
            name,
            description,
            is_visible: if visible { 1 } else { 0 },
            created_at,
            updated_at,
        },
        features,
    })
}

fn parse_feature(fj: &Value, layer_id: &str, idx: usize) -> Option<FeatureWithVertices> {
    let geom = fj.get("geometry")?;
    let gtype = geom.get("type")?.as_str()?;
    let coords = geom.get("coordinates")?;

    let (feature_type, vertices) = match gtype {
        "Point" => ("POINT", vec![parse_coord(coords, 0)?]),
        "LineString" => ("LINE", parse_coord_list(coords)?),
        "Polygon" => ("POLYGON", parse_polygon(coords)?),
        // Unsupported geometries (MultiPolygon, GeometryCollection, ...) are skipped.
        _ => return None,
    };

    let id = fj
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("{}-{}", layer_id, idx));

    let props = fj.get("properties");
    let name = props
        .and_then(|p| p.get("name"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let style_properties = props
        .and_then(|p| p.get("style"))
        .map(|s| s.to_string())
        .or_else(|| Some(json!({ "color": DEFAULT_FEATURE_COLOR }).to_string()));

    Some(FeatureWithVertices {
        id,
        layer_id: layer_id.to_string(),
        feature_type: feature_type.to_string(),
        name,
        style_properties,
        vertices,
    })
}

fn parse_coord(c: &Value, seq: i32) -> Option<Vertex> {
    let arr = c.as_array()?;
    if arr.len() < 2 {
        return None;
    }
    let lng = arr[0].as_f64()?;
    let lat = arr[1].as_f64()?;
    let alt = arr.get(2).and_then(|v| v.as_f64());
    Some(Vertex {
        latitude: lat,
        longitude: lng,
        altitude: alt,
        sequence: seq,
    })
}

fn parse_coord_list(coords: &Value) -> Option<Vec<Vertex>> {
    let arr = coords.as_array()?;
    let mut out = Vec::with_capacity(arr.len());
    for (i, c) in arr.iter().enumerate() {
        out.push(parse_coord(c, i as i32)?);
    }
    Some(out)
}

fn parse_polygon(coords: &Value) -> Option<Vec<Vertex>> {
    let rings = coords.as_array()?;
    let outer = rings.first()?;
    let mut verts = parse_coord_list(outer)?;
    // Drop the duplicate closing coordinate; the wrapper stores an open ring.
    if verts.len() >= 2 && same_position(&verts[0], &verts[verts.len() - 1]) {
        verts.pop();
    }
    for (i, v) in verts.iter_mut().enumerate() {
        v.sequence = i as i32;
    }
    Some(verts)
}
