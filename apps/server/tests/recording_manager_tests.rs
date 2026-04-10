mod common;

use server::recording::RecordingManager;
use server::state::{MediaType, Protocol, StreamDescriptor, StreamRegistry};
use std::sync::Arc;
use tokio::sync::broadcast;
use webrtc::rtp::packet::Packet;

fn setup_test_streams() -> Arc<StreamRegistry> {
    let registry = StreamRegistry::new();
    let (tx, _) = broadcast::channel::<Packet>(1024);

    let descriptor = StreamDescriptor {
        id: 12345,
        topic: "test/stream/topic".to_string(),
        user_id: "device_001".to_string(),
        media_type: MediaType::Video,
        protocol: Protocol::RTSP,
    };

    registry.insert_with_sender(descriptor, tx);
    Arc::new(registry)
}

#[test]
fn test_is_recording_false_initially() {
    let pool = common::setup_test_pool();
    let streams = setup_test_streams();
    let manager = RecordingManager::new(streams, pool);

    assert!(!manager.is_recording("test/stream/topic"));
}

#[test]
fn test_get_active_recording_id_none() {
    let pool = common::setup_test_pool();
    let streams = setup_test_streams();
    let manager = RecordingManager::new(streams, pool);

    assert!(manager.get_active_recording_id("any").is_none());
}

#[test]
fn test_get_all_active_recordings_empty() {
    let pool = common::setup_test_pool();
    let streams = setup_test_streams();
    let manager = RecordingManager::new(streams, pool);

    assert!(manager.get_all_active_recordings().is_empty());
}

#[test]
fn test_start_recording_stream_not_found() {
    let pool = common::setup_test_pool();
    let streams = Arc::new(StreamRegistry::new());
    let manager = RecordingManager::new(streams, pool);

    let result = manager.start_recording("nonexistent", None);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("Stream not found"));
}

#[test]
fn test_stop_recording_not_found() {
    let pool = common::setup_test_pool();
    let streams = setup_test_streams();
    let manager = RecordingManager::new(streams, pool);

    let result = manager.stop_recording(99999);
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("Recording not found"));
}

#[test]
fn test_stop_recording_by_topic_not_found() {
    let pool = common::setup_test_pool();
    let streams = setup_test_streams();
    let manager = RecordingManager::new(streams, pool);

    let result = manager.stop_recording_by_topic("nonexistent");
    assert!(result.is_err());
    assert!(result.unwrap_err().to_string().contains("No active recording"));
}
