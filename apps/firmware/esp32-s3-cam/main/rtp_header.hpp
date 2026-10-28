// RTP fixed header (RFC 3550). Header-only and free of ESP-IDF includes so the host tests can use it.
#pragma once

#include <cstddef>
#include <cstdint>

namespace rtp {

inline constexpr size_t kHeaderLen = 12;
// 1200 bytes of payload keeps IP + UDP + RTP under a 1280-byte path MTU (the IPv6 minimum),
// so no hop has to fragment a packet.
inline constexpr size_t kMaxPayload = 1200;
inline constexpr size_t kMaxPacket = kHeaderLen + kMaxPayload;

inline constexpr uint8_t kVersion = 2;
inline constexpr uint8_t kPayloadTypeJpeg = 26;
inline constexpr uint8_t kPayloadTypeOpus = 111;
inline constexpr uint8_t kPayloadTypeMask = 0x7F;
inline constexpr uint8_t kMarkerBit = 0x80;

inline void write_header(uint8_t* buf, uint8_t payload_type, bool marker, uint16_t seq, uint32_t timestamp,
                         uint32_t ssrc) {
    buf[0] = static_cast<uint8_t>(kVersion << 6);
    buf[1] = static_cast<uint8_t>((marker ? kMarkerBit : 0) | (payload_type & kPayloadTypeMask));
    buf[2] = static_cast<uint8_t>(seq >> 8);
    buf[3] = static_cast<uint8_t>(seq);
    buf[4] = static_cast<uint8_t>(timestamp >> 24);
    buf[5] = static_cast<uint8_t>(timestamp >> 16);
    buf[6] = static_cast<uint8_t>(timestamp >> 8);
    buf[7] = static_cast<uint8_t>(timestamp);
    buf[8] = static_cast<uint8_t>(ssrc >> 24);
    buf[9] = static_cast<uint8_t>(ssrc >> 16);
    buf[10] = static_cast<uint8_t>(ssrc >> 8);
    buf[11] = static_cast<uint8_t>(ssrc);
}

}  // namespace rtp
