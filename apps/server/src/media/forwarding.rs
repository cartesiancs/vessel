//! Forwards a topic's RTP packets to a WebRTC track for as long as the peer is subscribed.
//!
//! A subscription follows the topic, not one stream handle: a camera that re-registers (new SSRC
//! after a Wi-Fi drop) or a stream rehydrated after the idle timeout gets a new handle and a new
//! broadcast channel. Before this, the forwarding task ended on the old channel's `Closed` and the
//! viewer froze until the page was reloaded.

use std::time::Duration;

use tokio::sync::{broadcast, watch};
use tokio::time::Instant;
use tracing::{info, warn};
use webrtc::rtp::packet::Packet;
use webrtc::track::track_local::track_local_static_rtp::TrackLocalStaticRTP;
use webrtc::track::track_local::TrackLocalWriter;

use crate::state::{MediaType, StreamHandle, StreamManager};

/// How often to look for the topic while no stream carries it.
const REATTACH_POLL: Duration = Duration::from_millis(250);
/// How often to check that the attached stream is still the topic's current one.
const SOURCE_CHECK_INTERVAL: Duration = Duration::from_secs(1);
/// Timestamp gap inserted when the source changes: one 30 fps frame at 90 kHz, 20 ms at 48 kHz.
const VIDEO_SWITCH_TICKS: u32 = 3000;
const AUDIO_SWITCH_TICKS: u32 = 960;

const NAL_TYPE_MASK: u8 = 0x1F;
const NAL_IDR: u8 = 5;
const NAL_SPS: u8 = 7;
const NAL_STAP_A: u8 = 24;
const NAL_FU_A: u8 = 28;
const FU_START_BIT: u8 = 0x80;
const STAP_A_SIZE_LEN: usize = 2;

/// True if the H.264 RTP payload starts an IDR frame or carries an SPS (single NAL, STAP-A or the
/// first FU-A fragment), i.e. a point where a decoder can start.
pub fn is_h264_keyframe(payload: &[u8]) -> bool {
    let Some(&first) = payload.first() else {
        return false;
    };
    match first & NAL_TYPE_MASK {
        NAL_IDR | NAL_SPS => true,
        NAL_STAP_A => {
            let mut offset = 1;
            while offset + STAP_A_SIZE_LEN < payload.len() {
                let size = (usize::from(payload[offset]) << 8) | usize::from(payload[offset + 1]);
                offset += STAP_A_SIZE_LEN;
                if matches!(payload[offset] & NAL_TYPE_MASK, NAL_IDR | NAL_SPS) {
                    return true;
                }
                offset += size;
            }
            false
        }
        NAL_FU_A => payload.get(1).is_some_and(|&header| {
            header & FU_START_BIT != 0 && matches!(header & NAL_TYPE_MASK, NAL_IDR | NAL_SPS)
        }),
        _ => false,
    }
}

/// Keeps sequence numbers and timestamps continuous on the outgoing track when the source stream
/// changes. Receivers treat a jump of thousands of sequence numbers on the same SSRC as loss or
/// reordering and can stall the jitter buffer.
#[derive(Debug)]
pub struct RtpRewriter {
    switch_ticks: u32,
    seq_offset: u16,
    ts_offset: u32,
    last_out: Option<(u16, u32)>,
}

impl RtpRewriter {
    pub fn new(switch_ticks: u32) -> Self {
        Self {
            switch_ticks,
            seq_offset: 0,
            ts_offset: 0,
            last_out: None,
        }
    }

    pub fn for_media(media_type: MediaType) -> Self {
        Self::new(match media_type {
            MediaType::Video => VIDEO_SWITCH_TICKS,
            MediaType::Audio => AUDIO_SWITCH_TICKS,
        })
    }

    /// `new_source` marks the first packet forwarded from a newly attached stream.
    pub fn rewrite(&mut self, packet: &mut Packet, new_source: bool) {
        if new_source {
            if let Some((seq, ts)) = self.last_out {
                self.seq_offset = seq.wrapping_add(1).wrapping_sub(packet.header.sequence_number);
                self.ts_offset = ts
                    .wrapping_add(self.switch_ticks)
                    .wrapping_sub(packet.header.timestamp);
            }
        }
        packet.header.sequence_number = packet.header.sequence_number.wrapping_add(self.seq_offset);
        packet.header.timestamp = packet.header.timestamp.wrapping_add(self.ts_offset);
        self.last_out = Some((packet.header.sequence_number, packet.header.timestamp));
    }
}

pub enum Delivery {
    Packet { packet: Packet, new_source: bool },
    Lagged(u64),
}

/// Receives a topic's packets across stream replacements.
pub struct TopicSubscription {
    streams: StreamManager,
    topic: String,
    media_type: MediaType,
    current: Option<(u32, broadcast::Receiver<Packet>)>,
    pending_new_source: bool,
    last_check: Instant,
}

impl TopicSubscription {
    pub fn new(streams: StreamManager, topic: String, media_type: MediaType) -> Self {
        Self {
            streams,
            topic,
            media_type,
            current: None,
            pending_new_source: false,
            last_check: Instant::now(),
        }
    }

    pub fn topic(&self) -> &str {
        &self.topic
    }

    fn find_current(&self) -> Option<StreamHandle> {
        // The topic index points at the latest registration; fall back to a scan because audio
        // and video can share a topic and the index holds only one SSRC per topic.
        if let Some(handle) = self.streams.get_by_topic(&self.topic) {
            if handle.descriptor.media_type == self.media_type {
                return Some(handle);
            }
        }
        self.streams
            .iter()
            .find(|entry| {
                entry.value().descriptor.topic == self.topic
                    && entry.value().descriptor.media_type == self.media_type
            })
            .map(|entry| entry.value().clone())
    }

    fn attach(&mut self, handle: &StreamHandle) {
        info!(
            "Forwarding '{}' from SSRC {}",
            self.topic, handle.descriptor.id
        );
        self.current = Some((handle.descriptor.id, handle.packet_tx.subscribe()));
        self.pending_new_source = true;
        self.last_check = Instant::now();
    }

    /// Waits for the next packet. Never returns while the topic has no stream; the caller races
    /// it against its own shutdown signal.
    pub async fn next(&mut self) -> Delivery {
        loop {
            if self.last_check.elapsed() >= SOURCE_CHECK_INTERVAL {
                self.last_check = Instant::now();
                let current_ssrc = self.current.as_ref().map(|(ssrc, _)| *ssrc);
                if let Some(handle) = self.find_current() {
                    if current_ssrc != Some(handle.descriptor.id) {
                        self.attach(&handle);
                    }
                }
            }

            let Some((ssrc, rx)) = self.current.as_mut() else {
                match self.find_current() {
                    Some(handle) => self.attach(&handle),
                    None => tokio::time::sleep(REATTACH_POLL).await,
                }
                continue;
            };

            match tokio::time::timeout(SOURCE_CHECK_INTERVAL, rx.recv()).await {
                Ok(Ok(packet)) => {
                    let new_source = std::mem::take(&mut self.pending_new_source);
                    return Delivery::Packet { packet, new_source };
                }
                Ok(Err(broadcast::error::RecvError::Lagged(skipped))) => {
                    return Delivery::Lagged(skipped);
                }
                Ok(Err(broadcast::error::RecvError::Closed)) => {
                    info!(
                        "Stream for '{}' (SSRC {}) closed; waiting for it to come back",
                        self.topic, ssrc
                    );
                    self.current = None;
                }
                Err(_elapsed) => {}
            }
        }
    }
}

/// Forwards packets until `closed` fires (peer connection reset or WebSocket ended) or the track
/// rejects a write. Video waits for a keyframe at the start, after a source change and after
/// dropped packets, so the decoder never starts mid-GOP.
pub async fn forward_topic(
    mut subscription: TopicSubscription,
    track: std::sync::Arc<TrackLocalStaticRTP>,
    payload_type: u8,
    ssrc: u32,
    mut closed: watch::Receiver<bool>,
) {
    let gate_on_keyframes = subscription.media_type == MediaType::Video;
    let mut rewriter = RtpRewriter::for_media(subscription.media_type);
    let mut waiting_for_keyframe = gate_on_keyframes;
    let mut source_changed = false;
    let mut lagged_total: u64 = 0;

    loop {
        if *closed.borrow() {
            break;
        }
        let delivery = tokio::select! {
            changed = closed.changed() => {
                if changed.is_err() {
                    break;
                }
                continue;
            }
            delivery = subscription.next() => delivery,
        };
        match delivery {
            Delivery::Packet {
                mut packet,
                new_source,
            } => {
                if new_source {
                    source_changed = true;
                    waiting_for_keyframe = gate_on_keyframes;
                }
                if waiting_for_keyframe {
                    if !is_h264_keyframe(&packet.payload) {
                        continue;
                    }
                    waiting_for_keyframe = false;
                }
                rewriter.rewrite(&mut packet, std::mem::take(&mut source_changed));
                packet.header.payload_type = payload_type;
                packet.header.ssrc = ssrc;
                if let Err(e) = track.write_rtp(&packet).await {
                    warn!(
                        "Stopping forwarding of '{}': track write failed: {}",
                        subscription.topic(),
                        e
                    );
                    break;
                }
            }
            Delivery::Lagged(skipped) => {
                lagged_total += skipped;
                waiting_for_keyframe = gate_on_keyframes;
                warn!(
                    "Forwarding of '{}' lagged {} packets (total {})",
                    subscription.topic(),
                    skipped,
                    lagged_total
                );
            }
        }
    }
    info!(
        "Forwarding of '{}' stopped (lagged {} packets in total)",
        subscription.topic(),
        lagged_total
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::{Protocol, StreamDescriptor, StreamRegistry};
    use std::sync::Arc;

    fn packet(seq: u16, ts: u32, payload: &[u8]) -> Packet {
        let mut p = Packet::default();
        p.header.sequence_number = seq;
        p.header.timestamp = ts;
        p.payload = bytes::Bytes::copy_from_slice(payload);
        p
    }

    fn descriptor(id: u32, topic: &str) -> StreamDescriptor {
        StreamDescriptor {
            id,
            topic: topic.to_string(),
            user_id: "dev".to_string(),
            media_type: MediaType::Video,
            protocol: Protocol::Udp,
        }
    }

    #[test]
    fn keyframe_detection_covers_single_stap_a_and_fu_a() {
        assert!(is_h264_keyframe(&[0x65, 0x88]));
        assert!(is_h264_keyframe(&[0x67, 0x42]));
        assert!(!is_h264_keyframe(&[0x41, 0x9a]));
        // STAP-A carrying SPS (size 2) then PPS.
        assert!(is_h264_keyframe(&[0x78, 0x00, 0x02, 0x67, 0x42, 0x00, 0x01, 0x68]));
        assert!(!is_h264_keyframe(&[0x78, 0x00, 0x01, 0x68]));
        // FU-A: start fragment of an IDR vs a middle fragment.
        assert!(is_h264_keyframe(&[0x7c, 0x85, 0x00]));
        assert!(!is_h264_keyframe(&[0x7c, 0x05, 0x00]));
        assert!(!is_h264_keyframe(&[]));
    }

    #[test]
    fn rewriter_passes_through_a_single_source() {
        let mut r = RtpRewriter::new(VIDEO_SWITCH_TICKS);
        let mut a = packet(100, 9000, &[]);
        r.rewrite(&mut a, true);
        assert_eq!((a.header.sequence_number, a.header.timestamp), (100, 9000));
        let mut b = packet(101, 12000, &[]);
        r.rewrite(&mut b, false);
        assert_eq!((b.header.sequence_number, b.header.timestamp), (101, 12000));
    }

    #[test]
    fn rewriter_keeps_numbering_continuous_across_a_source_change() {
        let mut r = RtpRewriter::new(VIDEO_SWITCH_TICKS);
        let mut a = packet(65535, 4_294_967_000, &[]);
        r.rewrite(&mut a, true);
        // The new source starts somewhere random.
        let mut b = packet(12, 777, &[]);
        r.rewrite(&mut b, true);
        assert_eq!(b.header.sequence_number, 0);
        assert_eq!(
            b.header.timestamp,
            4_294_967_000u32.wrapping_add(VIDEO_SWITCH_TICKS)
        );
        let mut c = packet(13, 777 + 3000, &[]);
        r.rewrite(&mut c, false);
        assert_eq!(c.header.sequence_number, 1);
        assert_eq!(
            c.header.timestamp,
            4_294_967_000u32.wrapping_add(2 * VIDEO_SWITCH_TICKS)
        );
    }

    #[tokio::test]
    async fn subscription_follows_the_topic_to_a_replacement_stream() {
        let registry: StreamManager = Arc::new(StreamRegistry::new());
        let first = registry.register(descriptor(1, "cam"));
        let mut sub = TopicSubscription::new(registry.clone(), "cam".to_string(), MediaType::Video);

        let tx = first.packet_tx.clone();
        let sender = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(50)).await;
            let _ = tx.send(packet(1, 1, &[1]));
        });
        match sub.next().await {
            Delivery::Packet { packet, new_source } => {
                assert_eq!(packet.payload[0], 1);
                assert!(new_source);
            }
            Delivery::Lagged(_) => panic!("unexpected lag"),
        }
        sender.await.unwrap();

        // Re-registration: the old handle goes away and a new SSRC carries the topic.
        drop(first);
        registry.remove_by_topic("cam", MediaType::Video);
        let second = registry.register(descriptor(2, "cam"));
        let tx = second.packet_tx.clone();
        tokio::spawn(async move {
            for _ in 0..20 {
                tokio::time::sleep(Duration::from_millis(100)).await;
                let _ = tx.send(packet(2, 2, &[2]));
            }
        });
        let delivery = tokio::time::timeout(Duration::from_secs(3), sub.next())
            .await
            .expect("subscription did not re-attach");
        match delivery {
            Delivery::Packet { packet, new_source } => {
                assert_eq!(packet.payload[0], 2);
                assert!(new_source);
            }
            Delivery::Lagged(_) => panic!("unexpected lag"),
        }
    }

    #[tokio::test]
    async fn subscription_waits_for_a_topic_that_does_not_exist_yet() {
        let registry: StreamManager = Arc::new(StreamRegistry::new());
        let mut sub = TopicSubscription::new(registry.clone(), "late".to_string(), MediaType::Video);
        let reg = registry.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(400)).await;
            let handle = reg.register(descriptor(9, "late"));
            for _ in 0..20 {
                tokio::time::sleep(Duration::from_millis(100)).await;
                let _ = handle.packet_tx.send(packet(9, 9, &[9]));
            }
        });
        let delivery = tokio::time::timeout(Duration::from_secs(3), sub.next())
            .await
            .expect("subscription never attached");
        assert!(matches!(delivery, Delivery::Packet { new_source: true, .. }));
    }
}
