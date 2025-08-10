use diesel::{ExpressionMethods, QueryDsl, RunQueryDsl, SelectableHelper};

use crate::{db::models::{Device, Entity, NewDevice, NewEntity, User}, state::DbPool};


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

pub fn delete_entity(pool: &DbPool, target_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::entities::dsl::*;
    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(entities.find(target_id)).execute(&mut conn)?;
    Ok(num_deleted)
}