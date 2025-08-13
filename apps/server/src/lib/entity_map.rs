use std::sync::Arc;
use axum::{extract::{State, Path}, Json};
use serde::Deserialize;
use serde_json::{json, Value};
use crate::{db::{self, models::{EntityWithConfig, NewEntity}}, error::AppError, state::AppState};


pub async fn map_entities(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<EntityWithConfig>>, AppError> {
    let entities = db::repository::get_all_entities_with_configs(&state.pool)?;

    println!("Mapped entities: {:?}", entities.len());
    Ok(Json(entities))
}