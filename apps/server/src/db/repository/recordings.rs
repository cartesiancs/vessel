use crate::db::models::{NewRecording, Recording, UpdateRecording};
use crate::state::DbPool;
use diesel::prelude::*;

pub fn create_recording(
    pool: &DbPool,
    new_recording: NewRecording,
) -> Result<Recording, anyhow::Error> {
    use crate::db::schema::recordings::dsl::*;

    let mut conn = pool.get()?;
    let recording = diesel::insert_into(recordings)
        .values(&new_recording)
        .get_result(&mut conn)?;

    Ok(recording)
}

pub fn get_all_recordings(pool: &DbPool) -> Result<Vec<Recording>, anyhow::Error> {
    use crate::db::schema::recordings::dsl::*;

    let mut conn = pool.get()?;
    let all_recordings = recordings
        .order(started_at.desc())
        .select(Recording::as_select())
        .load(&mut conn)?;

    Ok(all_recordings)
}

pub fn get_recordings_by_status(
    pool: &DbPool,
    target_status: &str,
) -> Result<Vec<Recording>, anyhow::Error> {
    use crate::db::schema::recordings::dsl::*;

    let mut conn = pool.get()?;
    let filtered_recordings = recordings
        .filter(status.eq(target_status))
        .order(started_at.desc())
        .select(Recording::as_select())
        .load(&mut conn)?;

    Ok(filtered_recordings)
}

pub fn get_recordings_by_topic(
    pool: &DbPool,
    target_topic: &str,
) -> Result<Vec<Recording>, anyhow::Error> {
    use crate::db::schema::recordings::dsl::*;

    let mut conn = pool.get()?;
    let filtered_recordings = recordings
        .filter(topic.eq(target_topic))
        .order(started_at.desc())
        .select(Recording::as_select())
        .load(&mut conn)?;

    Ok(filtered_recordings)
}

pub fn get_active_recording_by_topic(
    pool: &DbPool,
    target_topic: &str,
) -> Result<Option<Recording>, anyhow::Error> {
    use crate::db::schema::recordings::dsl::*;

    let mut conn = pool.get()?;
    let recording = recordings
        .filter(topic.eq(target_topic))
        .filter(status.eq("recording"))
        .first::<Recording>(&mut conn)
        .optional()?;

    Ok(recording)
}

pub fn get_recording_by_id(pool: &DbPool, recording_id: i32) -> Result<Recording, anyhow::Error> {
    use crate::db::schema::recordings::dsl::*;

    let mut conn = pool.get()?;
    let recording = recordings
        .find(recording_id)
        .select(Recording::as_select())
        .first(&mut conn)?;

    Ok(recording)
}

pub fn update_recording(
    pool: &DbPool,
    recording_id: i32,
    update_data: &UpdateRecording,
) -> Result<Recording, anyhow::Error> {
    use crate::db::schema::recordings::dsl::*;

    let mut conn = pool.get()?;
    let recording = diesel::update(recordings.find(recording_id))
        .set(update_data)
        .get_result(&mut conn)?;

    Ok(recording)
}

pub fn delete_recording(pool: &DbPool, recording_id: i32) -> Result<usize, anyhow::Error> {
    use crate::db::schema::recordings::dsl::*;

    let mut conn = pool.get()?;
    let num_deleted = diesel::delete(recordings.find(recording_id)).execute(&mut conn)?;

    Ok(num_deleted)
}

/// Mark all recordings with status="recording" as "abandoned"
/// Called on server startup to cleanup orphaned recordings from crashes
pub fn mark_orphaned_as_abandoned(pool: &DbPool) -> Result<usize, anyhow::Error> {
    use crate::db::schema::recordings::dsl::*;

    let mut conn = pool.get()?;
    let num_updated = diesel::update(recordings.filter(status.eq("recording")))
        .set((
            status.eq("abandoned"),
            ended_at.eq(diesel::dsl::now),
        ))
        .execute(&mut conn)?;

    Ok(num_updated)
}
