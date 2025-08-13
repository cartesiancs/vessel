use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{db::{self, models::{EntityWithConfig, NewEntity}}, error::AppError, state::{AppState, Protocol, TopicMapping}};



pub async fn remap_topics(State(state): State<Arc<AppState>>) -> Result<usize, AppError> {
    let entities = db::repository::get_all_entities_with_configs(&state.pool)?;
    
    let mut new_mappings = Vec::new();

     for entity_with_config in &entities {
        // 1. entity.platform 필드를 먼저 확인합니다.
        if let Some(platform) = &entity_with_config.entity.platform {
            
            let protocol = match platform.as_str() {
                "MQTT" => Some(Protocol::MQTT),
                "udp" => Some(Protocol::Udp),
                "lora" => Some(Protocol::Lora),
                _ => None, // 모르는 platform은 무시합니다.
            };

            // platform이 유효하고, configuration 데이터가 있을 경우에만 실행합니다.
            if let (Some(proto), Some(config)) = (protocol, &entity_with_config.configuration) {
                
                // 2. configuration JSON에서 직접 'state_topic' 키를 찾습니다.
                if let Some(topic) = config.get("state_topic").and_then(|v| v.as_str()) {
                    new_mappings.push(TopicMapping {
                        protocol: proto.clone(),
                        topic: topic.to_string(),
                        entity_id: entity_with_config.entity.entity_id.clone(),
                    });
                }

                // 'command_topic' 등 다른 토픽 종류도 동일한 방식으로 추가할 수 있습니다.
                if let Some(topic) = config.get("command_topic").and_then(|v| v.as_str()) {
                     new_mappings.push(TopicMapping {
                        protocol: proto.clone(), // proto는 Copy가 아니므로 clone() 필요
                        topic: topic.to_string(),
                        entity_id: entity_with_config.entity.entity_id.clone(),
                    });
                }
            }
        }
    }


    println!("🔄 Remapping topics for {:?}", new_mappings.clone());
    
    let num_mappings = new_mappings.len();
    
    let mut map = state.topic_map.write().await;
    *map = new_mappings;

    println!("✅ Topics re-mapped. Total mappings: {}", num_mappings);
    Ok(num_mappings)
}