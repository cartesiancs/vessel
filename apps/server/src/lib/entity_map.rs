use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{db::{self, models::{EntityWithConfig, NewEntity}}, error::AppError, state::{AppState, Protocol, TopicMapping}};



pub async fn remap_topics(State(state): State<Arc<AppState>>) -> Result<usize, AppError> {
    let entities = db::repository::get_all_entities_with_configs(&state.pool)?;
    
    let mut new_mappings = Vec::new();

     for entity_with_config in &entities {
        if let Some(platform) = &entity_with_config.entity.platform {
            
            let protocol = match platform.as_str() {
                "MQTT" => Some(Protocol::MQTT),
                "udp" => Some(Protocol::Udp),
                "lora" => Some(Protocol::Lora),
                _ => None, 
            };

            if let (Some(proto), Some(config)) = (protocol, &entity_with_config.configuration) {
                
                if let Some(topic) = config.get("state_topic").and_then(|v| v.as_str()) {
                    new_mappings.push(TopicMapping {
                        protocol: proto.clone(),
                        topic: topic.to_string(),
                        entity_id: entity_with_config.entity.entity_id.clone(),
                    });
                }

                if let Some(topic) = config.get("command_topic").and_then(|v| v.as_str()) {
                     new_mappings.push(TopicMapping {
                        protocol: proto.clone(),
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