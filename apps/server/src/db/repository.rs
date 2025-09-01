use chrono::Utc;
use diesel::{dsl::max, BelongingToDsl, Connection, ExpressionMethods, JoinOnDsl, OptionalExtension, QueryDsl, QueryResult, RunQueryDsl, SelectableHelper};
use serde_json::Value;

use crate::{db::models::{Device, DeviceToken, Entity, EntityConfiguration, EntityWithConfig, EntityWithStateAndConfig, Flow, FlowVersion, NewDevice, NewDeviceToken, NewEntity, NewEntityConfiguration, NewFlow, NewFlowVersion, NewState, NewStatesMeta, NewSystemConfiguration, NewUser, State, StatesMeta, SystemConfiguration, UpdateUser, User}, state::DbPool};
use crate::db::models::{
    MapLayer, NewMapLayer, UpdateMapLayer,
    MapFeature, NewMapFeature, UpdateMapFeature, FeatureWithVertices,
    MapVertex, NewMapVertex, LayerWithFeatures,
};

pub fn get_user_by_name(pool: &DbPool, target_username: &str) -> Result<User, anyhow::Error> {
    use crate::db::schema::users::dsl::*;

    let mut conn = pool.get()?;

    let user = users
        .filter(username.eq(target_username))
        .select(User::as_select())
        .first(&mut conn)?;

    Ok(user)
}

pub fn get_all_users(pool: &DbPool) -> Result<Vec<User>, anyhow::Error> {
    use crate::db::schema::users::dsl::*;

    let mut conn = pool.get()?;

    let all_users = users
        .select(User::as_select())
        .load::<User>(&mut conn)?;

    Ok(all_users)
}

pub fn create_user(pool: &DbPool, new_user: NewUser) -> Result<User, anyhow::Error> {
    use crate::db::schema::users::dsl::*;

    let mut conn = pool.get()?;
    let user = diesel::insert_into(users)
        .values(&new_user)
        .get_result(&mut conn)?;

    Ok(user)
}

pub fn get_user_by_id(pool: &DbPool, user_id: i32) -> Result<User, anyhow::Error> {
    use crate::db::schema::users::dsl::*;

    let mut conn = pool.get()?;
    let user = users.find(user_id).select(User::as_select()).first(&mut conn)?;

    Ok(user)
}

pub fn update_user(
    pool: &DbPool,
    user_id: i32,
    user_data: &UpdateUser,
) -> Result<User, anyhow::Error> {
    use crate::db::schema::users::dsl::*;

    let mut conn = pool.get()?;
    let user = diesel::update(users.find(user_id))
        .set(user_data)
        .get_result(&mut conn)?;

    Ok(user)
}

pub fn delete_user(pool: &DbPool, user_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::users::dsl::*;

    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(users.find(user_id)).execute(&mut conn)?;

    Ok(num_deleted)
}

pub fn create_device(pool: &DbPool, new_device: NewDevice) -> Result<Device, anyhow::Error> {
    use crate::db::schema::devices::dsl::*;
    let mut conn = pool.get()?;
    let device = diesel::insert_into(devices)
        .values(&new_device)
        .get_result(&mut conn)?;

    Ok(device)
}


pub fn get_all_devices(pool: &DbPool) -> Result<Vec<Device>, anyhow::Error> {
    use crate::db::schema::devices::dsl::*;
    let mut conn = pool.get()?;
    let all_devices = devices.select(Device::as_select()).load::<Device>(&mut conn)?;
    Ok(all_devices)
}

pub fn update_device(pool: &DbPool, target_id: i32, updated_device: &NewDevice) -> Result<Device, anyhow::Error> {
    use crate::db::schema::devices::dsl::*;
    let mut conn = pool.get()?;
    let device = diesel::update(devices.find(target_id))
        .set((
            device_id.eq(&updated_device.device_id),
            name.eq(&updated_device.name),
            manufacturer.eq(&updated_device.manufacturer),
            model.eq(&updated_device.model),
        ))
        .get_result(&mut conn)?;
    Ok(device)
}

pub fn delete_device(pool: &DbPool, target_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::devices::dsl::*;
    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(devices.find(target_id)).execute(&mut conn)?;
    Ok(num_deleted)
}


// --- Entity CRUD ---

pub fn create_entity(pool: &DbPool, new_entity: NewEntity) -> Result<Entity, anyhow::Error> {
    use crate::db::schema::entities::dsl::*;
    let mut conn = pool.get()?;
    let entity = diesel::insert_into(entities)
        .values(&new_entity)
        .get_result(&mut conn)?;
    Ok(entity)
}

pub fn get_all_entities(pool: &DbPool) -> Result<Vec<Entity>, anyhow::Error> {
    use crate::db::schema::entities::dsl::*;
    let mut conn = pool.get()?;
    let all_entities = entities.select(Entity::as_select()).load::<Entity>(&mut conn)?;
    Ok(all_entities)
}

pub fn update_entity(pool: &DbPool, target_id: i32, updated_entity: &NewEntity) -> Result<Entity, anyhow::Error> {
    use crate::db::schema::entities::dsl::*;
    let mut conn = pool.get()?;
    let entity = diesel::update(entities.find(target_id))
        .set((
            entity_id.eq(&updated_entity.entity_id),
            device_id.eq(updated_entity.device_id),
            friendly_name.eq(&updated_entity.friendly_name),
            platform.eq(&updated_entity.platform),
        ))
        .get_result(&mut conn)?;
    Ok(entity)
}

pub fn create_entity_with_config(
    pool: &DbPool,
    new_entity: NewEntity,
    config_str: &str,
) -> Result<(Entity, Option<EntityConfiguration>), anyhow::Error> {
    use crate::db::schema::entities;
    use crate::db::schema::entities_configurations;

    let mut conn = pool.get()?;

    conn.transaction(|conn| {
        let entity: Entity = diesel::insert_into(entities::table)
            .values(&new_entity)
            .get_result(conn)?;

        if !config_str.is_empty() {
            let new_config = NewEntityConfiguration {
                entity_id: entity.id,
                configuration: config_str,
            };

            let config: EntityConfiguration = diesel::insert_into(entities_configurations::table)
                .values(&new_config)
                .get_result(conn)?;
            
            Ok((entity, Some(config)))
        } else {
            Ok((entity, None))
        }
    })
}

pub fn get_all_entities_with_configs(
    pool: &DbPool,
) -> Result<Vec<EntityWithConfig>, anyhow::Error> {
    use crate::db::schema::entities::dsl as e;
    use crate::db::schema::entities_configurations::dsl as ec;

    let mut conn = pool.get()?;

    let results = e::entities
        .left_join(ec::entities_configurations.on(e::id.eq(ec::entity_id)))
        .load::<(Entity, Option<EntityConfiguration>)>(&mut conn)?;

    let entities_with_configs = results
        .into_iter()
        .map(|(entity, config_opt)| {
            let configuration = config_opt
                .map(|c| serde_json::from_str(&c.configuration).unwrap_or(serde_json::Value::Null))
                .filter(|v| !v.is_null());
            EntityWithConfig { entity, configuration }
        })
        .collect();

    Ok(entities_with_configs)
}

pub fn get_all_entities_with_configs_filter(
    pool: &DbPool,
    entity_type_filter: Option<String>,
) -> Result<Vec<EntityWithConfig>, anyhow::Error> {
    use crate::db::schema::entities::dsl as e;
    use crate::db::schema::entities_configurations::dsl as ec;

    let mut conn = pool.get()?;

    let mut query = e::entities
        .left_join(ec::entities_configurations.on(e::id.eq(ec::entity_id)))
        .into_boxed();

    if let Some(e_type) = entity_type_filter {
        query = query.filter(e::entity_type.eq(e_type));
    }

    let results = query.load::<(Entity, Option<EntityConfiguration>)>(&mut conn)?;

    let entities_with_configs = results
        .into_iter()
        .map(|(entity, config_opt)| {
            let configuration = config_opt
                .map(|c| serde_json::from_str(&c.configuration).unwrap_or(serde_json::Value::Null))
                .filter(|v| !v.is_null());
            EntityWithConfig { entity, configuration }
        })
        .collect();

    Ok(entities_with_configs)
}

pub fn get_entities_by_device_id(pool: &DbPool, target_device_id: i32) -> Result<Vec<Entity>, anyhow::Error> {
    use crate::db::schema::entities::dsl::*;
    let mut conn = pool.get()?;
    let results = entities
        .filter(device_id.eq(target_device_id))
        .select(Entity::as_select())
        .load::<Entity>(&mut conn)?;
    Ok(results)
}

pub fn update_entity_with_config(
    pool: &DbPool,
    target_id: i32,
    updated_entity: &NewEntity,
    config_str: &str,
) -> Result<(Entity, Option<EntityConfiguration>), anyhow::Error> {
    use crate::db::schema::entities;
    use crate::db::schema::entities_configurations;

    let mut conn = pool.get()?;

    conn.transaction(|conn| {
        let entity: Entity = diesel::update(entities::table.find(target_id))
            .set((
                entities::entity_id.eq(&updated_entity.entity_id),
                entities::device_id.eq(updated_entity.device_id),
                entities::friendly_name.eq(&updated_entity.friendly_name),
                entities::platform.eq(&updated_entity.platform),
                entities::entity_type.eq(&updated_entity.entity_type),
            ))
            .get_result(conn)?;
        
        use crate::db::schema::entities_configurations::dsl::*;
        if !config_str.is_empty() {
            let new_config = NewEntityConfiguration {
                entity_id: entity.id,
                configuration: config_str,
            };

            let config: EntityConfiguration = diesel::insert_into(entities_configurations)
                .values(&new_config)
                .on_conflict(entity_id)
                .do_update()
                .set(configuration.eq(config_str))
                .get_result(conn)?;

            Ok((entity, Some(config)))
        } else {
            diesel::delete(entities_configurations.filter(entity_id.eq(target_id))).execute(conn)?;
            Ok((entity, None))
        }
    })
}

pub fn delete_entity(pool: &DbPool, target_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::entities::dsl::*;
    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(entities.find(target_id)).execute(&mut conn)?;
    Ok(num_deleted)
}

pub fn create_system_config(
    pool: &DbPool,
    new_config: NewSystemConfiguration,
) -> Result<SystemConfiguration, anyhow::Error> {
    use crate::db::schema::system_configurations::dsl::*;
    let mut conn = pool.get()?;
    let config = diesel::insert_into(system_configurations)
        .values(&new_config)
        .get_result(&mut conn)?;
    Ok(config)
}

pub fn get_all_system_configs(pool: &DbPool) -> Result<Vec<SystemConfiguration>, anyhow::Error> {
    use crate::db::schema::system_configurations::dsl::*;
    let mut conn = pool.get()?;
    let configs = system_configurations
        .select(SystemConfiguration::as_select())
        .load::<SystemConfiguration>(&mut conn)?;
    Ok(configs)
}

pub fn update_system_config(
    pool: &DbPool,
    target_id: i32,
    updated_config: &NewSystemConfiguration,
) -> Result<SystemConfiguration, anyhow::Error> {
    use crate::db::schema::system_configurations::dsl::*;
    let mut conn = pool.get()?;
    let config = diesel::update(system_configurations.find(target_id))
        .set(updated_config)
        .get_result(&mut conn)?;
    Ok(config)
}

pub fn delete_system_config(pool: &DbPool, target_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::system_configurations::dsl::*;
    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(system_configurations.find(target_id)).execute(&mut conn)?;
    Ok(num_deleted)
}

pub fn create_or_replace_device_token(
    pool: &DbPool,
    target_device_id: i32,
    hashed_token: &str,
) -> Result<DeviceToken, anyhow::Error> {
    use crate::db::schema::device_tokens::dsl::*;
    let mut conn = pool.get()?;

    let new_token = NewDeviceToken {
        device_id: target_device_id,
        token_hash: hashed_token,
    };

    let token = diesel::insert_into(device_tokens)
        .values(&new_token)
        .on_conflict(device_id)
        .do_update()
        .set(token_hash.eq(hashed_token))
        .get_result(&mut conn)?;

    Ok(token)
}

pub fn get_token_info_for_device(
    pool: &DbPool,
    target_device_id: i32,
) -> Result<Option<DeviceToken>, anyhow::Error> {
    use crate::db::schema::device_tokens::dsl::*;
    let mut conn = pool.get()?;
    let token_info = device_tokens
        .filter(device_id.eq(target_device_id))
        .select(DeviceToken::as_select())
        .first::<DeviceToken>(&mut conn)
        .optional()?;
    Ok(token_info)
}

pub fn delete_token_for_device(pool: &DbPool, target_device_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::device_tokens::dsl::*;
    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(device_tokens.filter(device_id.eq(target_device_id)))
        .execute(&mut conn)?;
    Ok(num_deleted)
}

pub fn get_device_by_device_id(pool: &DbPool, target_device_id: &str) -> Result<Device, anyhow::Error> {
    use crate::db::schema::devices::dsl::*;
    let mut conn = pool.get()?;
    let device_result = devices
        .filter(device_id.eq(target_device_id))
        .select(Device::as_select())
        .first::<Device>(&mut conn)?;
    Ok(device_result)
}

pub fn get_device_by_id(pool: &DbPool, target_id: i32) -> Result<Device, anyhow::Error> {
    use crate::db::schema::devices::dsl::*;
    let mut conn = pool.get()?;
    let device_result = devices
        .filter(id.eq(target_id))
        .select(Device::as_select())
        .first::<Device>(&mut conn)?;
    Ok(device_result)
}


pub fn create_flow(pool: &DbPool, new_flow: NewFlow) -> Result<Flow, anyhow::Error> {
    use crate::db::schema::flows::dsl::*;
    let mut conn = pool.get()?;

   let version_insert = diesel::insert_into(flows)
        .values(&new_flow)
        .returning(Flow::as_returning())
        .get_result(&mut conn)?;

    Ok(version_insert)
}

pub fn get_all_flows(pool: &DbPool) -> Result<Vec<Flow>, anyhow::Error> {
    use crate::db::schema::flows::dsl::*;
    let mut conn = pool.get()?;
    let all_flows = flows
        .select(Flow::as_select())
        .load::<Flow>(&mut conn)?;
    Ok(all_flows)
}

pub fn update_flow(pool: &DbPool, target_id: i32, updated_flow: &NewFlow) -> Result<usize, anyhow::Error> {
    use crate::db::schema::flows::dsl::*;
    let mut conn = pool.get()?;
    let num_updated = diesel::update(flows.find(target_id))
        .set(updated_flow)
        .execute(&mut conn)?;
    Ok(num_updated)
}

pub fn delete_flow(pool: &DbPool, target_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::flows::dsl::*;
    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(flows.find(target_id)).execute(&mut conn)?;
    Ok(num_deleted)
}



pub fn create_flow_version(
    pool: &DbPool,
    new_version_data: NewFlowVersion,
) -> Result<FlowVersion, anyhow::Error> {
    use crate::db::schema::flow_versions::dsl::*;
    let mut conn = pool.get()?;
    let version_insert = diesel::insert_into(flow_versions)
        .values(&new_version_data)
        .get_result(&mut conn)?;
    Ok(version_insert)
}

pub fn overwrite_flow_version(
    pool: &DbPool,
    target_flow_id: i32,
    new_version_data: NewFlowVersion,
) -> Result<FlowVersion, anyhow::Error> {
    use crate::db::schema::flow_versions;
    use crate::db::schema::flow_versions::dsl::*;
    let mut conn = pool.get()?;
    conn.transaction(|conn| {
        diesel::delete(flow_versions.filter(flow_id.eq(target_flow_id)))
            .execute(conn)?;
        let version_insert = diesel::insert_into(flow_versions::table)
            .values(&new_version_data)
            .get_result(conn)?;
        Ok(version_insert)
    })
}

pub fn get_latest_version_number(pool: &DbPool, target_flow_id: i32) -> Result<Option<i32>, anyhow::Error> {
    use crate::db::schema::flow_versions::dsl::*;
    let mut conn = pool.get()?;
    let max_version = flow_versions
        .filter(flow_id.eq(target_flow_id))
        .select(max(version))
        .first::<Option<i32>>(&mut conn)?;
    Ok(max_version)
}

pub fn get_versions_for_flow(
    pool: &DbPool,
    target_flow_id: i32,
) -> Result<Vec<FlowVersion>, anyhow::Error> {
    use crate::db::schema::flow_versions::dsl::*;
    let mut conn = pool.get()?;
    let versions = flow_versions
        .filter(flow_id.eq(target_flow_id))
        .order(version.desc())
        .select(FlowVersion::as_select())
        .load::<FlowVersion>(&mut conn)?;
    Ok(versions)
}


pub fn set_entity_state(
    pool: &DbPool,
    target_entity_id: &str,
    new_state_value: &str,
    new_attributes: Option<&Value>,
) -> Result<State, anyhow::Error> {
    let mut conn = pool.get()?;

    conn.transaction(|conn| {
        let meta: StatesMeta = {
            use crate::db::schema::states_meta::dsl::*; 
            let existing_meta = states_meta
                .filter(entity_id.eq(target_entity_id))
                .first::<StatesMeta>(conn)
                .optional()?;

            if let Some(meta) = existing_meta {
                meta
            } else {
                use crate::db::schema::entities::dsl::{entities, entity_id as entity_id_col}; // 'self::' 제거
                entities
                    .filter(entity_id_col.eq(target_entity_id))
                    .select(crate::db::schema::entities::id)
                    .first::<i32>(conn)
                    .map_err(|_| anyhow::anyhow!("Entity with id '{}' not found", target_entity_id))?;

                let new_meta = NewStatesMeta { entity_id: target_entity_id };
                diesel::insert_into(states_meta)
                    .values(&new_meta)
                    .get_result(conn)?
            }
        };
        
        use crate::db::schema::states::dsl::*; 
        let last_state_record: Option<State> = states
            .filter(metadata_id.eq(meta.metadata_id))
            .order(last_updated.desc())
            .first::<State>(conn)
            .optional()?;
            
        let now_utc = Utc::now().naive_utc();

        let last_changed_time = if let Some(ref last_state) = last_state_record {
            if last_state.state.as_deref() != Some(new_state_value) {
                Some(now_utc)
            } else {
                last_state.last_changed
            }
        } else {
            Some(now_utc)
        };
        
        let attributes_string = new_attributes
            .map(|v| serde_json::to_string(v))
            .transpose()?;

        let new_state = NewState {
            metadata_id: Some(meta.metadata_id),
            state: Some(new_state_value),
            attributes: attributes_string.as_deref(),
            last_changed: last_changed_time,
            last_updated: Some(now_utc),
            created: Some(now_utc),
        };

        diesel::insert_into(states)
            .values(&new_state)
            .get_result(conn)
            .map_err(anyhow::Error::from)
    })
}

pub fn get_all_entities_with_states_and_configs(
    pool: &DbPool,
) -> Result<Vec<EntityWithStateAndConfig>, anyhow::Error> {
    use crate::db::schema::entities::dsl as e;
    use crate::db::schema::entities_configurations::dsl as ec;
    use crate::db::schema::states::dsl as s;
    use crate::db::schema::states_meta::dsl as sm;

    let mut conn = pool.get()?;

    let entities_and_configs = e::entities
        .left_join(ec::entities_configurations.on(e::id.eq(ec::entity_id)))
        .load::<(Entity, Option<EntityConfiguration>)>(&mut conn)?;

    let states_meta_map: std::collections::HashMap<String, i32> = sm::states_meta
        .load::<StatesMeta>(&mut conn)?
        .into_iter()
        .map(|meta| (meta.entity_id, meta.metadata_id))
        .collect();

 
    let all_states = s::states
        .order(s::last_updated.desc())
        .load::<State>(&mut conn)?;
    
    let latest_states: std::collections::HashMap<i32, State> = all_states
        .into_iter()
        .fold(std::collections::HashMap::new(), |mut acc, state| {
            if let Some(mid) = state.metadata_id {
                acc.entry(mid).or_insert(state);
            }
            acc
        });

    let result = entities_and_configs
        .into_iter()
        .map(|(entity, config_opt)| {
            let configuration = config_opt
                .map(|c| serde_json::from_str(&c.configuration).unwrap_or(serde_json::Value::Null))
                .filter(|v| !v.is_null());

            let state = states_meta_map
                .get(&entity.entity_id)
                .and_then(|metadata_id| latest_states.get(metadata_id).cloned());

            EntityWithStateAndConfig {
                entity,
                configuration,
                state,
            }
        })
        .collect();

    Ok(result)
}

pub fn get_all_entities_with_states_and_configs_filter(
    pool: &DbPool,
    entity_type_filter: Option<String>,
) -> Result<Vec<EntityWithStateAndConfig>, anyhow::Error> {
    use crate::db::schema::entities::dsl as e;
    use crate::db::schema::entities_configurations::dsl as ec;
    use crate::db::schema::states::dsl as s;
    use crate::db::schema::states_meta::dsl as sm;

    let mut conn = pool.get()?;

    let mut entities_query = e::entities
        .left_join(ec::entities_configurations.on(e::id.eq(ec::entity_id)))
        .into_boxed();
    
    if let Some(e_type) = entity_type_filter {
        entities_query = entities_query.filter(e::entity_type.eq(e_type));
    }

    let entities_and_configs = entities_query.load::<(Entity, Option<EntityConfiguration>)>(&mut conn)?;

    let states_meta_map: std::collections::HashMap<String, i32> = sm::states_meta
        .load::<StatesMeta>(&mut conn)?
        .into_iter()
        .map(|meta| (meta.entity_id, meta.metadata_id))
        .collect();

    let all_states = s::states
        .order(s::last_updated.desc())
        .load::<State>(&mut conn)?;
    
    let latest_states: std::collections::HashMap<i32, State> = all_states
        .into_iter()
        .fold(std::collections::HashMap::new(), |mut acc, state| {
            if let Some(mid) = state.metadata_id {
                acc.entry(mid).or_insert(state);
            }
            acc
        });

    let result = entities_and_configs
        .into_iter()
        .map(|(entity, config_opt)| {
            let configuration = config_opt
                .map(|c| serde_json::from_str(&c.configuration).unwrap_or(serde_json::Value::Null))
                .filter(|v| !v.is_null());

            let state = states_meta_map
                .get(&entity.entity_id)
                .and_then(|metadata_id| latest_states.get(metadata_id).cloned());

            EntityWithStateAndConfig {
                entity,
                configuration,
                state,
            }
        })
        .collect();

    Ok(result)
}

pub fn create_map_layer(pool: &DbPool, new_layer: NewMapLayer) -> Result<MapLayer, anyhow::Error> {
    use crate::db::schema::map_layers::dsl::*;

    let mut conn = pool.get()?;
    let layer = diesel::insert_into(map_layers)
        .values(&new_layer)
        .get_result(&mut conn)?;
    Ok(layer)
}

pub fn get_all_map_layers(pool: &DbPool) -> Result<Vec<MapLayer>, anyhow::Error> {
    use crate::db::schema::map_layers::dsl::*;

    let mut conn = pool.get()?;
    let layers = map_layers.select(MapLayer::as_select()).load(&mut conn)?;
    Ok(layers)
}

pub fn get_map_layer_with_features(pool: &DbPool, target_layer_id: i32) -> Result<LayerWithFeatures, anyhow::Error> {
    use crate::db::schema::{map_layers, map_features, map_vertices};

    let mut conn = pool.get()?;

    let layer: MapLayer = map_layers::table
        .find(target_layer_id)
        .first(&mut conn)?;

    let features: Vec<MapFeature> = MapFeature::belonging_to(&layer)
        .select(MapFeature::as_select())
        .load(&mut conn)?;

    let vertices: Vec<MapVertex> = MapVertex::belonging_to(&features)
        .select(MapVertex::as_select())
        .load(&mut conn)?;

    let features_with_vertices = features.into_iter().map(|f| {
        let feature_vertices = vertices.iter()
            .filter(|v| v.feature_id == f.id)
            .cloned()
            .collect();
        FeatureWithVertices { feature: f, vertices: feature_vertices }
    }).collect();

    Ok(LayerWithFeatures { layer, features: features_with_vertices })
}

pub fn update_map_layer(pool: &DbPool, target_layer_id: i32, update_data: &UpdateMapLayer) -> Result<MapLayer, anyhow::Error> {
    use crate::db::schema::map_layers::dsl::*;

    let mut conn = pool.get()?;
    let layer = diesel::update(map_layers.find(target_layer_id))
        .set(update_data)
        .get_result(&mut conn)?;
    Ok(layer)
}

pub fn delete_map_layer(pool: &DbPool, target_layer_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::{map_layers, map_features, map_vertices};

    let mut conn = pool.get()?;
    conn.transaction::<_, anyhow::Error, _>(|conn| {
        let features_to_delete: Vec<MapFeature> = map_features::table
            .filter(map_features::layer_id.eq(target_layer_id))
            .load(conn)?;
        
        if !features_to_delete.is_empty() {
            let feature_ids: Vec<i32> = features_to_delete.iter().map(|f| f.id).collect();

            diesel::delete(map_vertices::table.filter(map_vertices::feature_id.eq_any(feature_ids)))
                .execute(conn)?;
            
            diesel::delete(map_features::table.filter(map_features::layer_id.eq(target_layer_id)))
                .execute(conn)?;
        }
        
        let num_deleted = diesel::delete(map_layers::table.find(target_layer_id)).execute(conn)?;
        Ok(num_deleted)
    })
}

pub fn create_map_feature(pool: &DbPool, new_feature: NewMapFeature, vertices_data: Vec<NewMapVertex>) -> Result<MapFeature, anyhow::Error> {
    use crate::db::schema::{map_features, map_vertices};

    let mut conn = pool.get()?;

    let feature = conn.transaction::<_, diesel::result::Error, _>(|conn| {
        let feature: MapFeature = diesel::insert_into(map_features::table)
            .values(&new_feature)
            .get_result(conn)?;

        let vertices_with_id: Vec<NewMapVertex> = vertices_data
            .into_iter()
            .map(|mut v| {
                v.feature_id = feature.id;
                v
            })
            .collect();
        
        diesel::insert_into(map_vertices::table)
            .values(&vertices_with_id)
            .execute(conn)?;

        Ok(feature)
    })?;

    Ok(feature)
}

pub fn get_map_feature_with_vertices(pool: &DbPool, target_feature_id: i32) -> Result<FeatureWithVertices, anyhow::Error> {
    use crate::db::schema::{map_features, map_vertices};
    let mut conn = pool.get()?;

    let feature: MapFeature = map_features::table.find(target_feature_id).first(&mut conn)?;
    let vertices: Vec<MapVertex> = MapVertex::belonging_to(&feature).load(&mut conn)?;
    
    Ok(FeatureWithVertices { feature, vertices })
}

pub fn update_map_feature(
    pool: &DbPool,
    target_feature_id: i32,
    feature_data: &UpdateMapFeature,
    new_vertices_data: Option<Vec<NewMapVertex>>,
) -> Result<MapFeature, anyhow::Error> {
    use crate::db::schema::{map_features, map_vertices};

    let mut conn = pool.get()?;

    conn.transaction::<_, anyhow::Error, _>(|conn| {
        if feature_data.has_changes() {
            diesel::update(map_features::table.find(target_feature_id))
                .set(feature_data)
                .execute(conn)?;
        }
        
        if let Some(vertices_data) = new_vertices_data {
            diesel::delete(map_vertices::table.filter(map_vertices::feature_id.eq(target_feature_id)))
                .execute(conn)?;
            
            let vertices_with_id: Vec<NewMapVertex> = vertices_data
                .into_iter()
                .map(|mut v| {
                    v.feature_id = target_feature_id;
                    v
                })
                .collect();
            
            diesel::insert_into(map_vertices::table)
                .values(&vertices_with_id)
                .execute(conn)?;
        }

        let result = map_features::table.find(target_feature_id).first(conn)?;
        Ok(result)
    })
    .map_err(Into::into)
}

pub fn delete_map_feature(pool: &DbPool, target_feature_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::{map_features, map_vertices};

    let mut conn = pool.get()?;
    conn.transaction::<_, anyhow::Error, _>(|conn| {
        diesel::delete(map_vertices::table.filter(map_vertices::feature_id.eq(target_feature_id)))
            .execute(conn)?;
        
        let num_deleted = diesel::delete(map_features::table.find(target_feature_id)).execute(conn)?;
        Ok(num_deleted)
    })
}