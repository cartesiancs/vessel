//! KML export (hand-written) and import (event-based parse via quick-xml).
//! Styling on import is not preserved (KML StyleMaps vary widely); features get
//! the default color and keep their name + geometry.

use anyhow::Result;
use quick_xml::events::Event;
use quick_xml::Reader;
use serde_json::json;

use super::{
    same_position, FeatureWithVertices, LayerWithFeatures, MapLayer, Vertex, DEFAULT_FEATURE_COLOR,
};

const KML_LINE_WIDTH: u32 = 2;

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

pub fn to_kml(layer: &LayerWithFeatures) -> String {
    let mut s = String::new();
    s.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    s.push_str("<kml xmlns=\"http://www.opengis.net/kml/2.2\">\n<Document>\n");
    s.push_str(&format!("<name>{}</name>\n", xml_escape(&layer.layer.name)));
    for (i, f) in layer.features.iter().enumerate() {
        write_placemark(&mut s, f, i);
    }
    s.push_str("</Document>\n</kml>\n");
    s
}

fn write_placemark(s: &mut String, f: &FeatureWithVertices, idx: usize) {
    let name = f
        .name
        .clone()
        .unwrap_or_else(|| format!("Feature {}", idx + 1));
    let color = hex_to_kml_color(&feature_color(f));

    s.push_str("<Placemark>\n");
    s.push_str(&format!("<name>{}</name>\n", xml_escape(&name)));
    s.push_str("<Style>\n");
    s.push_str(&format!(
        "<LineStyle><color>{}</color><width>{}</width></LineStyle>\n",
        color, KML_LINE_WIDTH
    ));
    s.push_str(&format!("<PolyStyle><color>{}</color></PolyStyle>\n", color));
    s.push_str("</Style>\n");

    match f.feature_type.as_str() {
        "POINT" => {
            s.push_str(&format!(
                "<Point><coordinates>{}</coordinates></Point>\n",
                coords_str(&f.vertices, false)
            ));
        }
        "LINE" => {
            s.push_str(&format!(
                "<LineString><coordinates>{}</coordinates></LineString>\n",
                coords_str(&f.vertices, false)
            ));
        }
        "POLYGON" => {
            s.push_str(&format!(
                "<Polygon><outerBoundaryIs><LinearRing><coordinates>{}</coordinates></LinearRing></outerBoundaryIs></Polygon>\n",
                coords_str(&f.vertices, true)
            ));
        }
        _ => {}
    }
    s.push_str("</Placemark>\n");
}

fn coord_tuple(v: &Vertex) -> String {
    format!("{},{},{}", v.longitude, v.latitude, v.altitude.unwrap_or(0.0))
}

fn coords_str(verts: &[Vertex], close_ring: bool) -> String {
    let mut parts: Vec<String> = verts.iter().map(coord_tuple).collect();
    if close_ring {
        if let (Some(first), Some(last)) = (verts.first(), verts.last()) {
            if !same_position(first, last) {
                parts.push(coord_tuple(first));
            }
        }
    }
    parts.join(" ")
}

fn feature_color(f: &FeatureWithVertices) -> String {
    f.style_properties
        .as_ref()
        .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
        .and_then(|v| v.get("color").and_then(|c| c.as_str()).map(String::from))
        .unwrap_or_else(|| DEFAULT_FEATURE_COLOR.to_string())
}

/// `#rrggbb` -> KML `aabbggrr` (alpha forced opaque).
fn hex_to_kml_color(hex: &str) -> String {
    let h = hex.trim_start_matches('#');
    if h.len() == 6 && h.chars().all(|c| c.is_ascii_hexdigit()) {
        let r = &h[0..2];
        let g = &h[2..4];
        let b = &h[4..6];
        format!("ff{}{}{}", b.to_lowercase(), g.to_lowercase(), r.to_lowercase())
    } else {
        "ff0000ff".to_string()
    }
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

#[derive(PartialEq)]
enum Capture {
    None,
    PlacemarkName,
    DocName,
    Coords,
}

pub fn from_kml(content: &str) -> Result<LayerWithFeatures> {
    let mut reader = Reader::from_str(content);

    let mut features: Vec<FeatureWithVertices> = Vec::new();
    let mut doc_name: Option<String> = None;

    let mut in_placemark = false;
    let mut cur_name: Option<String> = None;
    let mut cur_geom: Option<&'static str> = None;
    let mut cur_coords: Option<String> = None;
    let mut got_coords = false;
    let mut capture = Capture::None;

    loop {
        match reader.read_event()? {
            Event::Start(e) => match e.local_name().as_ref() {
                b"Placemark" => {
                    in_placemark = true;
                    cur_name = None;
                    cur_geom = None;
                    cur_coords = None;
                    got_coords = false;
                }
                b"name" => {
                    capture = if in_placemark {
                        Capture::PlacemarkName
                    } else {
                        Capture::DocName
                    };
                }
                b"Point" if in_placemark => cur_geom = Some("POINT"),
                b"LineString" if in_placemark => cur_geom = Some("LINE"),
                b"Polygon" if in_placemark => cur_geom = Some("POLYGON"),
                b"coordinates" if in_placemark && !got_coords => {
                    capture = Capture::Coords;
                    cur_coords = Some(String::new());
                }
                _ => {}
            },
            Event::Text(e) => {
                let txt = e.unescape()?;
                match capture {
                    Capture::PlacemarkName => cur_name = Some(txt.trim().to_string()),
                    Capture::DocName => doc_name = Some(txt.trim().to_string()),
                    Capture::Coords => {
                        if let Some(c) = cur_coords.as_mut() {
                            c.push_str(&txt);
                        }
                    }
                    Capture::None => {}
                }
            }
            Event::CData(e) => {
                if capture == Capture::Coords {
                    if let Ok(txt) = std::str::from_utf8(e.as_ref()) {
                        if let Some(c) = cur_coords.as_mut() {
                            c.push_str(txt);
                        }
                    }
                }
            }
            Event::End(e) => match e.local_name().as_ref() {
                b"name" => capture = Capture::None,
                b"coordinates" => {
                    if capture == Capture::Coords {
                        capture = Capture::None;
                        got_coords = true;
                    }
                }
                b"Placemark" => {
                    if let (Some(g), Some(c)) = (cur_geom, cur_coords.take()) {
                        if let Some(verts) = parse_kml_coords(&c, g) {
                            features.push(FeatureWithVertices {
                                id: String::new(),
                                layer_id: String::new(),
                                feature_type: g.to_string(),
                                name: cur_name.take(),
                                style_properties: Some(
                                    json!({ "color": DEFAULT_FEATURE_COLOR }).to_string(),
                                ),
                                vertices: verts,
                            });
                        }
                    }
                    in_placemark = false;
                    cur_geom = None;
                    got_coords = false;
                }
                _ => {}
            },
            Event::Eof => break,
            _ => {}
        }
    }

    let name = doc_name.unwrap_or_else(|| "Imported Layer".to_string());
    Ok(LayerWithFeatures {
        layer: MapLayer {
            id: String::new(),
            name,
            description: None,
            is_visible: 1,
            created_at: String::new(),
            updated_at: String::new(),
        },
        features,
    })
}

fn parse_kml_coords(text: &str, geom: &str) -> Option<Vec<Vertex>> {
    let mut verts = Vec::new();
    for (i, tuple) in text.split_whitespace().enumerate() {
        let mut it = tuple.split(',');
        let lng: f64 = it.next()?.trim().parse().ok()?;
        let lat: f64 = it.next()?.trim().parse().ok()?;
        let alt = it.next().and_then(|s| s.trim().parse::<f64>().ok());
        verts.push(Vertex {
            latitude: lat,
            longitude: lng,
            altitude: alt,
            sequence: i as i32,
        });
    }
    if verts.is_empty() {
        return None;
    }
    if geom == "POINT" {
        verts.truncate(1);
    }
    if geom == "POLYGON" && verts.len() >= 2 && same_position(&verts[0], &verts[verts.len() - 1]) {
        verts.pop();
        for (i, v) in verts.iter_mut().enumerate() {
            v.sequence = i as i32;
        }
    }
    Some(verts)
}
