use crate::{
    db::models::{DynamicDashboard, NewDynamicDashboard, UpdateDynamicDashboard},
    db::schema::dynamic_dashboards::dsl::*,
    state::DbPool,
};
use chrono::Utc;
use diesel::{prelude::*, OptionalExtension};
use serde_json::Value;
use uuid::Uuid;

pub fn list_dynamic_dashboards(pool: &DbPool) -> Result<Vec<DynamicDashboard>, anyhow::Error> {
    let mut conn = pool.get()?;
    let dashboards = dynamic_dashboards
        .select(DynamicDashboard::as_select())
        .order_by(created_at.asc())
        .load::<DynamicDashboard>(&mut conn)?;
    Ok(dashboards)
}

pub fn get_dynamic_dashboard(
    pool: &DbPool,
    target_id: &str,
) -> Result<Option<DynamicDashboard>, anyhow::Error> {
    let mut conn = pool.get()?;
    let dashboard = dynamic_dashboards
        .filter(id.eq(target_id))
        .select(DynamicDashboard::as_select())
        .first::<DynamicDashboard>(&mut conn)
        .optional()?;
    Ok(dashboard)
}

pub fn create_dynamic_dashboard(
    pool: &DbPool,
    name_value: &str,
    layout_json: &Value,
) -> Result<DynamicDashboard, anyhow::Error> {
    let mut conn = pool.get()?;
    let layout_str = serde_json::to_string(layout_json)?;
    let new_dashboard = NewDynamicDashboard {
        id: &Uuid::new_v4().to_string(),
        name: name_value,
        layout: &layout_str,
    };

    let created = diesel::insert_into(dynamic_dashboards)
        .values(&new_dashboard)
        .get_result::<DynamicDashboard>(&mut conn)?;

    Ok(created)
}

pub fn update_dynamic_dashboard(
    pool: &DbPool,
    target_id: &str,
    name_value: Option<&str>,
    layout_json: Option<&Value>,
) -> Result<Option<DynamicDashboard>, anyhow::Error> {
    let mut conn = pool.get()?;
    let layout_str = layout_json.map(|v| serde_json::to_string(v)).transpose()?;

    let changes = UpdateDynamicDashboard {
        name: name_value,
        layout: layout_str.as_deref(),
        updated_at: Some(Utc::now().naive_utc()),
    };

    let updated = diesel::update(dynamic_dashboards.filter(id.eq(target_id)))
        .set(changes)
        .get_result::<DynamicDashboard>(&mut conn)
        .optional()?;

    Ok(updated)
}

pub fn delete_dynamic_dashboard(pool: &DbPool, target_id: &str) -> Result<usize, anyhow::Error> {
    let mut conn = pool.get()?;
    let deleted = diesel::delete(dynamic_dashboards.filter(id.eq(target_id))).execute(&mut conn)?;
    Ok(deleted)
}
