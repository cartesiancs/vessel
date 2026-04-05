//! WebSocket `dashboard_component_event`: dashboard widgets → `dashboard_ui` broadcast.

use crate::state::{AppState, DashboardUiEvent};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tracing::{info, warn};

const SERVER_MIN_COOLDOWN_MS: u64 = 100;
const MAX_LISTENER_ID_LEN: usize = 128;

#[derive(Debug, Deserialize)]
struct DashboardComponentEventV2 {
    pub event_version: u32,
    pub event_id: String,
    pub listener_id: String,
    #[serde(default)]
    pub occurred_at: Option<String>,
    #[serde(default)]
    pub dashboard_id: Option<String>,
    #[serde(default)]
    pub group_id: Option<String>,
    #[serde(default)]
    pub item_id: Option<String>,
    pub component_type: String,
    pub action: String,
    #[serde(default)]
    pub value: Option<Value>,
    pub source_session_id: String,
    #[serde(default)]
    pub cooldown_ms: Option<u64>,
}

fn rate_limit_key(ev: &DashboardComponentEventV2) -> String {
    format!(
        "{}|{}|{}|{}",
        ev.source_session_id,
        ev.listener_id,
        ev.item_id.as_deref().unwrap_or("-"),
        ev.action
    )
}

fn cooldown_ms(ev: &DashboardComponentEventV2) -> u64 {
    SERVER_MIN_COOLDOWN_MS.max(ev.cooldown_ms.unwrap_or(320))
}

fn validate_listener_id(id: &str) -> bool {
    let t = id.trim();
    if t.is_empty() || t.len() > MAX_LISTENER_ID_LEN {
        return false;
    }
    t.chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

/// Validates and publishes to `AppState::dashboard_ui_tx`. Updates `rate` when accepted.
pub(crate) fn apply_dashboard_component_event(
    raw: serde_json::Value,
    state: &AppState,
    rate: &mut HashMap<String, Instant>,
) {
    let ev: DashboardComponentEventV2 = match serde_json::from_value(raw) {
        Ok(v) => v,
        Err(e) => {
            warn!("dashboard_component_event: invalid payload: {}", e);
            return;
        }
    };

    if ev.event_version != 2 {
        warn!(
            "dashboard_component_event: unsupported event_version {} (need 2)",
            ev.event_version
        );
        return;
    }

    if ev.source_session_id.trim().is_empty() {
        warn!("dashboard_component_event: missing source_session_id");
        return;
    }

    let lid = ev.listener_id.trim();
    if !validate_listener_id(lid) {
        warn!(
            "dashboard_component_event: invalid listener_id (empty, too long, or bad chars)"
        );
        return;
    }

    let key = rate_limit_key(&ev);
    let cooldown = Duration::from_millis(cooldown_ms(&ev));
    let now = Instant::now();
    if let Some(last) = rate.get(&key) {
        if now.duration_since(*last) < cooldown {
            info!(
                "dashboard_component_event: rate limited event_id={}",
                ev.event_id
            );
            return;
        }
    }
    rate.insert(key, now);

    let out = DashboardUiEvent {
        listener_id: lid.to_string(),
        event_id: ev.event_id.clone(),
        occurred_at: ev.occurred_at.clone(),
        dashboard_id: ev.dashboard_id.clone(),
        group_id: ev.group_id.clone(),
        item_id: ev.item_id.clone(),
        component_type: ev.component_type.clone(),
        action: ev.action.clone(),
        value: ev.value.clone(),
        source_session_id: ev.source_session_id.clone(),
    };

    info!(
        event_id = %out.event_id,
        listener_id = %out.listener_id,
        component = %out.component_type,
        action = %out.action,
        "dashboard_component_event published",
    );

    if state.dashboard_ui_tx.send(out).is_err() {
        warn!("dashboard_component_event: no subscribers (dashboard_ui_tx closed)");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_v2() {
        let json = serde_json::json!({
            "event_version": 2,
            "event_id": "e1",
            "listener_id": "my-btn",
            "dashboard_id": "d1",
            "group_id": "g1",
            "item_id": "i1",
            "component_type": "button",
            "action": "click",
            "source_session_id": "sess",
        });
        let ev: DashboardComponentEventV2 = serde_json::from_value(json).unwrap();
        assert_eq!(ev.listener_id, "my-btn");
        assert_eq!(ev.event_version, 2);
    }

    #[test]
    fn listener_id_validation() {
        assert!(validate_listener_id("ok-1"));
        assert!(!validate_listener_id(""));
        assert!(!validate_listener_id("bad id"));
    }
}
