use crate::db::schema::{
    device_tokens, devices, entities, entities_configurations, events, flow_versions, flows,
    map_features, map_layers, map_vertices, states, states_meta, system_configurations, users,
};
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;

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

#[derive(Serialize, Clone)]
pub struct UserWithRoles {
    pub id: i32,
    pub username: String,
    pub email: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
    pub roles: Vec<Role>,
}

#[derive(Insertable)]
#[diesel(table_name = users)]
pub struct NewUser<'a> {
    pub username: &'a str,
    pub email: &'a str,
    pub password_hash: &'a str,
}

#[derive(AsChangeset, Deserialize, Default)]
#[diesel(table_name = users)]
pub struct UpdateUser {
    pub username: Option<String>,
    pub email: Option<String>,
    pub password_hash: Option<String>,
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

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Clone)]
#[diesel(table_name = entities)]
#[diesel(belongs_to(Device))]
pub struct Entity {
    pub id: i32,
    pub entity_id: String,
    pub device_id: Option<i32>,
    pub friendly_name: Option<String>,
    pub platform: Option<String>,
    pub entity_type: Option<String>,
}

#[derive(Insertable)]
#[diesel(table_name = entities)]
pub struct NewEntity<'a> {
    pub entity_id: &'a str,
    pub device_id: Option<i32>,
    pub friendly_name: Option<&'a str>,
    pub platform: Option<&'a str>,
    pub entity_type: Option<&'a str>,
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

#[derive(Serialize, Deserialize, Clone)]
pub struct EntityWithConfig {
    #[serde(flatten)]
    pub entity: Entity,
    pub configuration: Option<Value>,
}

#[derive(Serialize, Deserialize)]
pub struct EntityWithStateAndConfig {
    #[serde(flatten)]
    pub entity: Entity,
    pub configuration: Option<Value>,
    pub state: Option<State>,
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

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Clone)]
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

#[derive(Queryable, Selectable, Identifiable, Serialize, Clone, Debug)]
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

#[derive(Queryable, Selectable, Identifiable, Serialize, Clone)]
#[diesel(table_name = flows)]
pub struct Flow {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub enabled: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable, AsChangeset)]
#[diesel(table_name = flows)]
pub struct NewFlow<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub enabled: Option<i32>,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Clone)]
#[diesel(table_name = flow_versions)]
#[diesel(belongs_to(Flow))]
pub struct FlowVersion {
    pub id: i32,
    pub flow_id: i32,
    pub version: i32,
    pub graph_json: String,
    pub comment: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = flow_versions)]
pub struct NewFlowVersion<'a> {
    pub flow_id: i32,
    pub version: i32,
    pub graph_json: &'a str,
    pub comment: Option<&'a str>,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Clone)]
#[diesel(table_name = crate::db::schema::map_layers)]
#[diesel(belongs_to(User, foreign_key = owner_user_id))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct MapLayer {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub owner_user_id: i32,
    pub is_visible: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = map_layers)]
pub struct NewMapLayer<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
    pub owner_user_id: i32,
    pub is_visible: Option<i32>,
}

#[derive(AsChangeset, Deserialize)]
#[diesel(table_name = map_layers)]
pub struct UpdateMapLayer {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_visible: Option<i32>,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Clone)]
#[diesel(table_name = crate::db::schema::map_features)]
#[diesel(belongs_to(MapLayer, foreign_key = layer_id))]
#[diesel(belongs_to(User, foreign_key = created_by_user_id))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct MapFeature {
    pub id: i32,
    pub layer_id: i32,
    pub feature_type: String,
    pub name: Option<String>,
    pub style_properties: Option<String>,
    pub created_by_user_id: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Insertable)]
#[diesel(table_name = map_features)]
pub struct NewMapFeature<'a> {
    pub layer_id: i32,
    pub feature_type: &'a str,
    pub name: Option<&'a str>,
    pub style_properties: Option<&'a str>,
    pub created_by_user_id: i32,
}

#[derive(AsChangeset, Deserialize, Default)]
#[diesel(table_name = map_features)]
pub struct UpdateMapFeature {
    pub name: Option<String>,
    pub style_properties: Option<String>,
}

impl UpdateMapFeature {
    pub fn has_changes(&self) -> bool {
        self.name.is_some() || self.style_properties.is_some()
    }
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Clone)]
#[diesel(table_name = crate::db::schema::map_vertices)]
#[diesel(belongs_to(MapFeature, foreign_key = feature_id))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct MapVertex {
    pub id: i32,
    pub feature_id: i32,
    pub latitude: f32,
    pub longitude: f32,
    pub altitude: Option<f32>,
    pub sequence: i32,
}

#[derive(Insertable, Clone)]
#[diesel(table_name = map_vertices)]
pub struct NewMapVertex {
    pub feature_id: i32,
    pub latitude: f32,
    pub longitude: f32,
    pub altitude: Option<f32>,
    pub sequence: i32,
}

#[derive(Serialize, Clone)]
pub struct FeatureWithVertices {
    #[serde(flatten)]
    pub feature: MapFeature,
    pub vertices: Vec<MapVertex>,
}

#[derive(Serialize, Clone)]
pub struct LayerWithFeatures {
    #[serde(flatten)]
    pub layer: MapLayer,
    pub features: Vec<FeatureWithVertices>,
}

#[derive(Queryable, Selectable, Identifiable, Serialize, Deserialize, Clone)]
#[diesel(table_name = crate::db::schema::roles)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Role {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Insertable, AsChangeset, Deserialize)]
#[diesel(table_name = crate::db::schema::roles)]
pub struct NewRole<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
}

#[derive(Queryable, Selectable, Identifiable, Serialize, Deserialize, Clone)]
#[diesel(table_name = crate::db::schema::permissions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Permission {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Insertable, Deserialize)]
#[diesel(table_name = crate::db::schema::permissions)]
pub struct NewPermission<'a> {
    pub name: &'a str,
    pub description: Option<&'a str>,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Clone)]
#[diesel(table_name = crate::db::schema::user_roles)]
#[diesel(belongs_to(User))]
#[diesel(belongs_to(Role))]
#[diesel(primary_key(user_id, role_id))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct UserRole {
    pub user_id: i32,
    pub role_id: i32,
}

#[derive(Insertable)]
#[diesel(table_name = crate::db::schema::user_roles)]
pub struct NewUserRole {
    pub user_id: i32,
    pub role_id: i32,
}

#[derive(Queryable, Selectable, Identifiable, Associations, Serialize, Deserialize, Clone)]
#[diesel(table_name = crate::db::schema::role_permissions)]
#[diesel(belongs_to(Role))]
#[diesel(belongs_to(Permission))]
#[diesel(primary_key(role_id, permission_id))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct RolePermission {
    pub role_id: i32,
    pub permission_id: i32,
}

#[derive(Insertable)]
#[diesel(table_name = crate::db::schema::role_permissions)]
pub struct NewRolePermission {
    pub role_id: i32,
    pub permission_id: i32,
}

#[derive(Serialize, Clone)]
pub struct RoleWithPermissions {
    pub id: i32,
    pub name: String,
    pub description: Option<String>,
    pub permissions: Vec<Permission>,
}

#[derive(Queryable, Selectable, Identifiable, Serialize, Deserialize, Clone)]
#[diesel(table_name = crate::db::schema::custom_nodes)]
#[diesel(primary_key(node_type))]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct CustomNode {
    pub node_type: String,
    pub data: String,
}

#[derive(Insertable, Deserialize)]
#[diesel(table_name = crate::db::schema::custom_nodes)]
pub struct NewCustomNode<'a> {
    pub node_type: &'a str,
    pub data: &'a str,
}

#[derive(AsChangeset, Deserialize)]
#[diesel(table_name = crate::db::schema::custom_nodes)]
pub struct UpdateCustomNode {
    pub data: Option<String>,
}
