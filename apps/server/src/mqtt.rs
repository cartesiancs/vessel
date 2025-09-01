use std::sync::Arc;

use crate::{db, state::{AppState, MqttMessage, Protocol}};
use anyhow::Result;
use rumqttc::{AsyncClient, Event, EventLoop, Incoming, QoS};
use tokio::sync::broadcast;
use tracing::{error, info, warn};


pub async fn start_event_loop(
    client: AsyncClient,
    mut eventloop: EventLoop,
    mqtt_tx: broadcast::Sender<MqttMessage>,     
    state: Arc<AppState>,
) -> Result<()> {

    client.subscribe("#", QoS::AtMostOnce).await?;

    info!("Internal MQTT client connected and subscribed to all topics.");

    loop {
        match eventloop.poll().await {
            Ok(Event::Incoming(Incoming::Publish(p))) => {
                let topic_str = p.topic.clone();
                let payload_str = match std::str::from_utf8(&p.payload) {
                    Ok(v) => v,
                    Err(_) => {
                        warn!("Received non-UTF8 payload on topic '{}'. Skipping.", &topic_str);
                        continue;
                    }
                };
                let msg = MqttMessage {
                    topic: p.topic,
                    bytes: p.payload.to_vec().into(),
                };
                
                let topic_map = state.topic_map.read().await;
                let matched_mapping = topic_map.iter().find(|m| {
                    m.protocol == Protocol::MQTT && m.topic == topic_str
                });

                if let Some(mapping) = matched_mapping {
                    
                    let pool = state.pool.clone();
                    let entity_id = mapping.entity_id.clone();
                    let state_value = payload_str.to_string();

                    tokio::spawn(async move {
                        if let Err(e) = db::repository::set_entity_state(&pool, &entity_id, &state_value, None) {
                            error!("Failed to set entity state for '{}': {}", entity_id, e);
                        }
                    });
                }

                if mqtt_tx.send(msg).is_err() {
                    warn!("mqtt::event_loop ▶ receiver lagging, mqtt message dropped");
                }
            }
            Ok(Event::Incoming(Incoming::Disconnect)) => {
                warn!("MQTT client disconnected, stopping event loop.");
                break;
            }
            Err(e) => {
                error!("MQTT event loop error: {}", e);
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
            _ => {}
        }
    }
    Ok(())
}