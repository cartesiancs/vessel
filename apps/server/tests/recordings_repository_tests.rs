mod common;

use server::db::models::{NewRecording, UpdateRecording};
use server::db::repository::recordings::*;

fn create_test_recording<'a>() -> NewRecording<'a> {
    NewRecording {
        stream_ssrc: 12345,
        topic: "test/topic",
        device_id: "device_001",
        media_type: "video",
        filename: "test.mkv",
        file_path: "/tmp/test.mkv",
        status: "recording",
        created_by_user_id: Some(1),
    }
}

#[test]
fn test_create_recording() {
    let pool = common::setup_test_pool();
    let result = create_recording(&pool, create_test_recording());

    assert!(result.is_ok());
    assert_eq!(result.unwrap().topic, "test/topic");
}

#[test]
fn test_get_recording_by_id() {
    let pool = common::setup_test_pool();
    let created = create_recording(&pool, create_test_recording()).unwrap();

    let result = get_recording_by_id(&pool, created.id);
    assert!(result.is_ok());
}

#[test]
fn test_get_recording_by_id_not_found() {
    let pool = common::setup_test_pool();
    assert!(get_recording_by_id(&pool, 99999).is_err());
}

#[test]
fn test_get_all_recordings() {
    let pool = common::setup_test_pool();
    create_recording(&pool, create_test_recording()).unwrap();
    create_recording(&pool, create_test_recording()).unwrap();

    let result = get_all_recordings(&pool).unwrap();
    assert_eq!(result.len(), 2);
}

#[test]
fn test_get_recordings_by_status() {
    let pool = common::setup_test_pool();

    // Create one recording with "recording" status
    create_recording(&pool, create_test_recording()).unwrap();

    // Create one recording with "completed" status
    let mut completed = create_test_recording();
    completed.status = "completed";
    create_recording(&pool, completed).unwrap();

    let recording_status = get_recordings_by_status(&pool, "recording").unwrap();
    let completed_status = get_recordings_by_status(&pool, "completed").unwrap();

    assert_eq!(recording_status.len(), 1);
    assert_eq!(completed_status.len(), 1);
}

#[test]
fn test_update_recording() {
    let pool = common::setup_test_pool();
    let created = create_recording(&pool, create_test_recording()).unwrap();

    let update = UpdateRecording {
        status: Some("completed".to_string()),
        file_size: Some(1024),
        ..Default::default()
    };

    let updated = update_recording(&pool, created.id, &update).unwrap();
    assert_eq!(updated.status, "completed");
    assert_eq!(updated.file_size, 1024);
}

#[test]
fn test_delete_recording() {
    let pool = common::setup_test_pool();
    let created = create_recording(&pool, create_test_recording()).unwrap();

    assert_eq!(delete_recording(&pool, created.id).unwrap(), 1);
    assert!(get_recording_by_id(&pool, created.id).is_err());
}

#[test]
fn test_mark_orphaned_as_abandoned() {
    let pool = common::setup_test_pool();

    // Create two recordings with "recording" status
    create_recording(&pool, create_test_recording()).unwrap();
    create_recording(&pool, create_test_recording()).unwrap();

    // Create one recording with "completed" status
    let mut completed = create_test_recording();
    completed.status = "completed";
    create_recording(&pool, completed).unwrap();

    let count = mark_orphaned_as_abandoned(&pool).unwrap();
    assert_eq!(count, 2);

    // No recordings should have "recording" status anymore
    let still_recording = get_recordings_by_status(&pool, "recording").unwrap();
    assert_eq!(still_recording.len(), 0);

    // Two should be abandoned
    let abandoned = get_recordings_by_status(&pool, "abandoned").unwrap();
    assert_eq!(abandoned.len(), 2);
}
