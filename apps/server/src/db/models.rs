use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde_json::Value;
use crate::db::schema::{device_tokens, devices, entities, entities_configurations, events, states, states_meta, system_configurations, users};
use serde::{Deserialize, Serialize};

#[derive(Queryable, Selectable, Identifiable, Serialize)]
#[diesel(table_name = crate::db::schema::users)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct User {
    pub id: i32,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = users)]
pub struct NewUser<'a> {
    pub username: &'a str,
    pub email: &'a str,
    pub password_hash: &'a str,
}

#[derive(Queryable, Selectable, Identifiable, Serialize)]
#[diesel(table_name = devices)]
pub struct Device {
    pub id: i32,
    pub device_id: String,
    pub name: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
}

#[derive(Insertable)]
#[diesel(table_name = devices)]
pub struct NewDevice<'a> {
    pub device_id: &'a str,
    pub name: Option<&'a str>,
    pub manufacturer: Option<&'a str>,
    pub model: Option<&'a str>,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize)]
#[diesel(table_name = entities)]
#[diesel(belongs_to(Device))]
pub struct Entity {
    pub id: i32,
    pub entity_id: String,
    pub device_id: Option<i32>,
    pub friendly_name: Option<String>,
    pub platform: Option<String>,
}

#[derive(Insertable)]
#[diesel(table_name = entities)]
pub struct NewEntity<'a> {
    pub entity_id: &'a str,
    pub device_id: Option<i32>,
    pub friendly_name: Option<&'a str>,
    pub platform: Option<&'a str>,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Clone)]
#[diesel(table_name = entities_configurations)]
#[diesel(belongs_to(Entity))]
#[diesel(primary_key(id))]
pub struct EntityConfiguration {
    pub id: i32,
    pub entity_id: i32,
    pub configuration: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = entities_configurations)]
pub struct NewEntityConfiguration<'a> {
    pub entity_id: i32,
    pub configuration: &'a str,
}


#[derive(Serialize)]
pub struct EntityWithConfig {
    #[serde(flatten)]
    pub entity: Entity,
    pub configuration: Option<Value>,
}

#[derive(Queryable, Selectable, Identifiable, Serialize)]
#[diesel(table_name = states_meta)]
#[diesel(primary_key(metadata_id))]
pub struct StatesMeta {
    pub metadata_id: i32,
    pub entity_id: String,
}

#[derive(Insertable)]
#[diesel(table_name = states_meta)]
pub struct NewStatesMeta<'a> {
    pub entity_id: &'a str,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize)]
#[diesel(table_name = states)]
#[diesel(primary_key(state_id))]
#[diesel(belongs_to(StatesMeta, foreign_key = metadata_id))]
pub struct State {
    pub state_id: i32,
    pub metadata_id: Option<i32>,
    pub state: Option<String>,
    pub attributes: Option<String>,
    pub last_changed: Option<NaiveDateTime>,
    pub last_updated: Option<NaiveDateTime>,
    pub created: Option<NaiveDateTime>,
}

#[derive(Insertable)]
#[diesel(table_name = states)]
pub struct NewState<'a> {
    pub metadata_id: Option<i32>,
    pub state: Option<&'a str>,
    pub attributes: Option<&'a str>,
    pub last_changed: Option<NaiveDateTime>,
    pub last_updated: Option<NaiveDateTime>,
    pub created: Option<NaiveDateTime>,
}

#[derive(Queryable, Selectable, Identifiable, Serialize)]
#[diesel(table_name = events)]
#[diesel(primary_key(event_id))]
pub struct Event {
    pub event_id: i32,
    pub event_type: Option<String>,
    pub event_data: Option<String>,
    pub origin: Option<String>,
    pub time_fired: Option<NaiveDateTime>,
}

#[derive(Insertable)]
#[diesel(table_name = events)]
pub struct NewEvent<'a> {
    pub event_type: Option<&'a str>,
    pub event_data: Option<&'a str>,
    pub origin: Option<&'a str>,
    pub time_fired: Option<NaiveDateTime>,
}

#[derive(Queryable, Selectable, Identifiable, Serialize, Clone)]
#[diesel(table_name = system_configurations)]
pub struct SystemConfiguration {
    pub id: i32,
    pub key: String,
    pub value: String,
    pub enabled: i32, 
    pub description: Option<String>,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable, AsChangeset)]
#[diesel(table_name = system_configurations)]
pub struct NewSystemConfiguration<'a> {
    pub key: &'a str,
    pub value: &'a str,
    pub enabled: Option<i32>,
    pub description: Option<&'a str>,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Clone)]
#[diesel(table_name = device_tokens)]
#[diesel(belongs_to(Device))]
pub struct DeviceToken {
    pub id: i32,
    pub device_id: i32,
    #[serde(skip_serializing)] 
    pub token_hash: String,
    pub expires_at: Option<NaiveDateTime>,
    pub last_used_at: Option<NaiveDateTime>,
    pub created_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = device_tokens)]
pub struct NewDeviceToken<'a> {
    pub device_id: i32,
    pub token_hash: &'a str,
}
