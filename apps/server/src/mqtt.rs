use std::sync::Arc;

use crate::{db, state::{AppState, MqttMessage, Protocol}};
use anyhow::Result;
use rumqttc::{AsyncClient, Event, Incoming, MqttOptions, QoS};
use tokio::sync::broadcast;
use tracing::{error, info, warn};


pub async fn start_event_loop(
    broker_address: String, 
    mqtt_tx: broadcast::Sender<MqttMessage>,     
    state: Arc<AppState>,
) -> Result<()> {

  let parts: Vec<&str> = broker_address.split(':').collect();
    if parts.len() != 2 {
        return Err(anyhow::anyhow!(
            "Invalid broker address format. Expected 'host:port', got '{}'",
            broker_address
        ));
    }
    let host = parts[0];
    let port: u16 = parts[1].parse()?;

    let mut mqttoptions = MqttOptions::new("rust-internal-client", host, port);
    mqttoptions.set_keep_alive(std::time::Duration::from_secs(5));

    let (client, mut eventloop) = AsyncClient::new(mqttoptions, 10);
    client.subscribe("#", QoS::AtMostOnce).await?;

    println!("Internal MQTT client connected and subscribed to all topics.");

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
                
                println!("Received MQTT message on topic '{}': {:?}", msg.topic, msg.bytes);

                let topic_map = state.topic_map.read().await;
                let matched_mapping = topic_map.iter().find(|m| {
                    // 와일드카드(+)를 고려한 토픽 매칭이 필요하다면 별도 라이브러리(e.g., paho-mqtt)나 로직이 필요합니다.
                    // 여기서는 간단한 문자열 비교로 처리합니다.
                    m.protocol == Protocol::MQTT && m.topic == topic_str
                });

                if let Some(mapping) = matched_mapping {
                    println!("Found mapping: Topic '{}' -> Entity '{}'", &topic_str, &mapping.entity_id);
                    
                    // DB에 상태 기록 (에러 처리를 위해 spawn 사용)
                    let pool = state.pool.clone();
                    let entity_id = mapping.entity_id.clone();
                    let state_value = payload_str.to_string();

                    tokio::spawn(async move {
                        // 여기서는 attributes를 None으로 처리합니다. 필요 시 JSON 파싱 로직을 추가할 수 있습니다.
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