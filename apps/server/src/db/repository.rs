use diesel::{dsl::max, BoolExpressionMethods, Connection, ExpressionMethods, JoinOnDsl, OptionalExtension, QueryDsl, QueryResult, RunQueryDsl, SelectableHelper};

use crate::{db::models::{Device, DeviceToken, Entity, EntityConfiguration, EntityWithConfig, Flow, FlowVersion, NewDevice, NewDeviceToken, NewEntity, NewEntityConfiguration, NewFlow, NewFlowVersion, NewSystemConfiguration, SystemConfiguration, User}, state::DbPool};


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

