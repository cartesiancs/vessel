use server::state::{MediaType, Protocol, StreamDescriptor, StreamRegistry};
use tokio::sync::broadcast;
use webrtc::rtp::packet::Packet;

fn create_test_descriptor(id: u32, topic: &str) -> StreamDescriptor {
    StreamDescriptor {
        id,
        topic: topic.to_string(),
        user_id: "test_user".to_string(),
        media_type: MediaType::Video,
        protocol: Protocol::RTSP,
    }
}

#[test]
fn test_register_stream() {
    let registry = StreamRegistry::new();
    let descriptor = create_test_descriptor(1, "rtsp://test/stream1");

    let handle = registry.register(descriptor);

    assert_eq!(handle.descriptor.id, 1);
    assert_eq!(registry.len(), 1);
}

#[test]
fn test_get_by_ssrc() {
    let registry = StreamRegistry::new();
    registry.register(create_test_descriptor(42, "test_topic"));

    assert!(registry.get_by_ssrc(42).is_some());
    assert!(registry.get_by_ssrc(999).is_none());
}

#[test]
fn test_get_by_topic() {
    let registry = StreamRegistry::new();
    registry.register(create_test_descriptor(1, "unique/topic/path"));

    assert!(registry.get_by_topic("unique/topic/path").is_some());
    assert!(registry.get_by_topic("nonexistent").is_none());
}

#[test]
fn test_mark_online() {
    let registry = StreamRegistry::new();
    let handle = registry.register(create_test_descriptor(1, "test"));

    assert!(!*handle.is_online.read().unwrap());
    registry.mark_online(1);
    assert!(*handle.is_online.read().unwrap());
}

#[test]
fn test_remove() {
    let registry = StreamRegistry::new();
    registry.register(create_test_descriptor(1, "topic1"));
    registry.register(create_test_descriptor(2, "topic2"));

    assert_eq!(registry.len(), 2);
    registry.remove(&1);
    assert_eq!(registry.len(), 1);
    assert!(registry.get_by_topic("topic1").is_none());
}

#[test]
fn test_insert_with_sender() {
    let registry = StreamRegistry::new();
    let (tx, _) = broadcast::channel::<Packet>(16);
    let descriptor = create_test_descriptor(100, "custom");

    registry.insert_with_sender(descriptor, tx);
    assert!(registry.get_by_ssrc(100).is_some());
}

#[test]
fn test_iter() {
    let registry = StreamRegistry::new();
    registry.register(create_test_descriptor(1, "t1"));
    registry.register(create_test_descriptor(2, "t2"));

    let ids: Vec<u32> = registry.iter().map(|e| *e.key()).collect();
    assert_eq!(ids.len(), 2);
}
