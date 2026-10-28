// RFC 2435 JPEG-over-RTP payload format: parses a baseline JFIF frame and splits its entropy-coded
// data into RTP payloads with in-band quantization tables (Q = 255).
// Pure C++ (no ESP-IDF includes) so it can be unit tested on the host.
#pragma once

#include <cstddef>
#include <cstdint>

namespace rtp_jpeg {

inline constexpr uint8_t kTypeYuv422 = 0;
inline constexpr uint8_t kTypeYuv420 = 1;
// Added to the type when the frame carries a restart interval (RFC 2435 section 3.1.7).
inline constexpr uint8_t kTypeRestartFlag = 64;
inline constexpr uint8_t kQInBandTables = 255;
// Width and height travel as 8-pixel units in one byte.
inline constexpr uint32_t kMaxDimension = 255 * 8;
inline constexpr size_t kQuantTableLen = 64;
inline constexpr size_t kQuantTablesLen = 2 * kQuantTableLen;

enum class Error {
    Ok,
    NotJpeg,                // no SOI, or a marker byte where one is required is missing
    Truncated,              // the buffer ends before the frame does
    UnsupportedFrame,       // not baseline sequential (SOF0) 8-bit
    UnsupportedPrecision,   // 16-bit quantization table
    UnsupportedSampling,    // not Y 2x1 / 2x2 with Cb, Cr 1x1, or not exactly 3 components
    UnsupportedDimensions,  // zero, or larger than kMaxDimension
    MissingTables,          // a component refers to a quantization table that was not defined
    MissingFrame,           // no SOF0 before SOS
    MissingScan,            // EOI before any SOS
};

const char* error_name(Error e);

struct Frame {
    uint8_t type = 0;  // kTypeYuv422 / kTypeYuv420, plus kTypeRestartFlag when restart_interval != 0
    uint16_t width = 0;
    uint16_t height = 0;
    uint16_t restart_interval = 0;
    // Luma table followed by chroma table, in the zig-zag order they have in the DQT segment.
    uint8_t quant_tables[kQuantTablesLen] = {};
    // False when a DHT segment differs from the JPEG Annex K tables, which RFC 2435 receivers assume.
    bool standard_huffman = true;
    const uint8_t* scan = nullptr;  // entropy-coded data, EOI excluded
    size_t scan_len = 0;
};

Error parse(const uint8_t* jpeg, size_t len, Frame& out);

}  // namespace rtp_jpeg
