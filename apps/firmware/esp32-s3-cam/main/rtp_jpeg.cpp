#include "rtp_jpeg.hpp"

#include <algorithm>
#include <cstring>

namespace rtp_jpeg {
namespace {

constexpr uint8_t kMarkerPrefix = 0xFF;
constexpr uint8_t kSoi = 0xD8;
constexpr uint8_t kEoi = 0xD9;
constexpr uint8_t kSof0 = 0xC0;
constexpr uint8_t kDht = 0xC4;
constexpr uint8_t kJpgReserved = 0xC8;
constexpr uint8_t kDac = 0xCC;
constexpr uint8_t kSofLast = 0xCF;
constexpr uint8_t kRst0 = 0xD0;
constexpr uint8_t kRst7 = 0xD7;
constexpr uint8_t kSos = 0xDA;
constexpr uint8_t kDqt = 0xDB;
constexpr uint8_t kDri = 0xDD;
constexpr uint8_t kTem = 0x01;
constexpr uint8_t kStuffedZero = 0x00;

constexpr size_t kMarkerLen = 2;
constexpr size_t kSegmentLengthLen = 2;
constexpr size_t kSofFixedLen = 6;  // precision, height, width, component count
constexpr size_t kSofComponentLen = 3;
constexpr size_t kComponents = 3;
constexpr uint8_t kSamplePrecision = 8;
constexpr uint8_t kMaxQuantTableId = 3;
constexpr size_t kQuantTableSlots = kMaxQuantTableId + 1;
constexpr uint8_t kMaxHuffmanTableId = 1;
constexpr size_t kHuffmanCountsLen = 16;
constexpr uint8_t kSamplingH2V1 = 0x21;
constexpr uint8_t kSamplingH2V2 = 0x22;
constexpr uint8_t kSamplingH1V1 = 0x11;
constexpr uint8_t kPixelsPerUnit = 8;

constexpr uint16_t kRestartCountUnaligned = 0x3FFF;  // with F = L = 1: packets don't align to intervals
constexpr uint8_t kRestartFirstLastBits = 0xC0;

// JPEG Annex K.3 tables. RFC 2435 receivers rebuild the JFIF header with exactly these.
constexpr uint8_t kDcLumaCounts[kHuffmanCountsLen] = {0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0};
constexpr uint8_t kDcChromaCounts[kHuffmanCountsLen] = {0, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0};
constexpr uint8_t kDcValues[] = {0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11};
constexpr uint8_t kAcLumaCounts[kHuffmanCountsLen] = {0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7D};
constexpr uint8_t kAcLumaValues[] = {
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71,
    0x14, 0x32, 0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35, 0x36, 0x37,
    0x38, 0x39, 0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x83,
    0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3,
    0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
    0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA,
};
constexpr uint8_t kAcChromaCounts[kHuffmanCountsLen] = {0, 2, 1, 2, 4, 4, 3, 4, 7, 5, 4, 4, 0, 1, 2, 0x77};
constexpr uint8_t kAcChromaValues[] = {
    0x00, 0x01, 0x02, 0x03, 0x11, 0x04, 0x05, 0x21, 0x31, 0x06, 0x12, 0x41, 0x51, 0x07, 0x61, 0x71, 0x13, 0x22,
    0x32, 0x81, 0x08, 0x14, 0x42, 0x91, 0xA1, 0xB1, 0xC1, 0x09, 0x23, 0x33, 0x52, 0xF0, 0x15, 0x62, 0x72, 0xD1,
    0x0A, 0x16, 0x24, 0x34, 0xE1, 0x25, 0xF1, 0x17, 0x18, 0x19, 0x1A, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x35, 0x36,
    0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58,
    0x59, 0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A,
    0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A,
    0xA2, 0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA,
    0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA,
    0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA,
};
constexpr size_t kAcValueCount = 162;
static_assert(sizeof(kAcLumaValues) == kAcValueCount);
static_assert(sizeof(kAcChromaValues) == kAcValueCount);

struct HuffmanSpec {
    const uint8_t* counts;
    const uint8_t* values;
    size_t value_count;
};

// Indexed by [class (0 = DC, 1 = AC)][table id].
constexpr HuffmanSpec kStandardHuffman[2][kMaxHuffmanTableId + 1] = {
    {{kDcLumaCounts, kDcValues, sizeof(kDcValues)}, {kDcChromaCounts, kDcValues, sizeof(kDcValues)}},
    {{kAcLumaCounts, kAcLumaValues, kAcValueCount}, {kAcChromaCounts, kAcChromaValues, kAcValueCount}},
};

uint16_t read_be16(const uint8_t* p) { return static_cast<uint16_t>((p[0] << 8) | p[1]); }

struct QuantTables {
    uint8_t data[kQuantTableSlots][kQuantTableLen] = {};
    bool defined[kQuantTableSlots] = {};
};

Error parse_dqt(const uint8_t* seg, size_t len, QuantTables& tables) {
    size_t pos = 0;
    while (pos < len) {
        const uint8_t precision = seg[pos] >> 4;
        const uint8_t id = seg[pos] & 0x0F;
        if (precision != 0) {
            return Error::UnsupportedPrecision;
        }
        if (id > kMaxQuantTableId) {
            return Error::NotJpeg;
        }
        if (len - pos - 1 < kQuantTableLen) {
            return Error::Truncated;
        }
        memcpy(tables.data[id], seg + pos + 1, kQuantTableLen);
        tables.defined[id] = true;
        pos += 1 + kQuantTableLen;
    }
    return Error::Ok;
}

struct FrameHeader {
    uint16_t width = 0;
    uint16_t height = 0;
    uint8_t sampling[kComponents] = {};
    uint8_t quant_id[kComponents] = {};
    bool present = false;
};

Error parse_sof0(const uint8_t* seg, size_t len, FrameHeader& out) {
    if (len < kSofFixedLen) {
        return Error::Truncated;
    }
    if (seg[0] != kSamplePrecision) {
        return Error::UnsupportedFrame;
    }
    out.height = read_be16(seg + 1);
    out.width = read_be16(seg + 3);
    const uint8_t components = seg[5];
    if (components != kComponents) {
        return Error::UnsupportedSampling;
    }
    if (len < kSofFixedLen + kComponents * kSofComponentLen) {
        return Error::Truncated;
    }
    for (size_t i = 0; i < kComponents; i++) {
        const uint8_t* c = seg + kSofFixedLen + i * kSofComponentLen;
        out.sampling[i] = c[1];
        out.quant_id[i] = c[2];
    }
    out.present = true;
    return Error::Ok;
}

bool huffman_matches(const uint8_t* counts, const uint8_t* values, size_t value_count, const HuffmanSpec& spec) {
    return value_count == spec.value_count && memcmp(counts, spec.counts, kHuffmanCountsLen) == 0 &&
           memcmp(values, spec.values, value_count) == 0;
}

// Returns Truncated on a malformed segment; clears `standard` when a table differs from Annex K.
Error check_dht(const uint8_t* seg, size_t len, bool& standard) {
    size_t pos = 0;
    while (pos < len) {
        if (len - pos < 1 + kHuffmanCountsLen) {
            return Error::Truncated;
        }
        const uint8_t table_class = seg[pos] >> 4;
        const uint8_t id = seg[pos] & 0x0F;
        const uint8_t* counts = seg + pos + 1;
        size_t value_count = 0;
        for (size_t i = 0; i < kHuffmanCountsLen; i++) {
            value_count += counts[i];
        }
        const size_t table_len = 1 + kHuffmanCountsLen + value_count;
        if (len - pos < table_len) {
            return Error::Truncated;
        }
        const uint8_t* values = counts + kHuffmanCountsLen;
        if (table_class > 1 || id > kMaxHuffmanTableId ||
            !huffman_matches(counts, values, value_count, kStandardHuffman[table_class][id])) {
            standard = false;
        }
        pos += table_len;
    }
    return Error::Ok;
}

bool is_unsupported_sof(uint8_t marker) {
    return marker > kSof0 && marker <= kSofLast && marker != kDht && marker != kJpgReserved && marker != kDac;
}

bool is_standalone(uint8_t marker) { return marker == kTem || (marker >= kRst0 && marker <= kRst7); }

// Inside entropy-coded data every 0xFF is followed by a stuffed 0x00 or an RSTn marker, so the
// first 0xFF 0xD9 pair is the real end of the scan.
Error find_eoi(const uint8_t* jpeg, size_t len, size_t start, size_t& eoi) {
    size_t pos = start;
    while (pos + 1 < len) {
        const void* hit = memchr(jpeg + pos, kMarkerPrefix, len - pos - 1);
        if (hit == nullptr) {
            break;
        }
        pos = static_cast<size_t>(static_cast<const uint8_t*>(hit) - jpeg);
        if (jpeg[pos + 1] == kEoi) {
            eoi = pos;
            return Error::Ok;
        }
        pos += (jpeg[pos + 1] == kStuffedZero || is_standalone(jpeg[pos + 1])) ? kMarkerLen : 1;
    }
    return Error::Truncated;
}

Error fill_frame(const FrameHeader& sof, const QuantTables& tables, Frame& out) {
    if (sof.width == 0 || sof.height == 0 || sof.width > kMaxDimension || sof.height > kMaxDimension) {
        return Error::UnsupportedDimensions;
    }
    if (sof.sampling[1] != kSamplingH1V1 || sof.sampling[2] != kSamplingH1V1) {
        return Error::UnsupportedSampling;
    }
    if (sof.sampling[0] == kSamplingH2V1) {
        out.type = kTypeYuv422;
    } else if (sof.sampling[0] == kSamplingH2V2) {
        out.type = kTypeYuv420;
    } else {
        return Error::UnsupportedSampling;
    }
    // RFC 2435 carries one luma and one chroma table, so both chroma components must share one.
    const uint8_t luma_id = sof.quant_id[0];
    const uint8_t chroma_id = sof.quant_id[1];
    if (sof.quant_id[2] != chroma_id || luma_id > kMaxQuantTableId || chroma_id > kMaxQuantTableId ||
        !tables.defined[luma_id] || !tables.defined[chroma_id]) {
        return Error::MissingTables;
    }
    memcpy(out.quant_tables, tables.data[luma_id], kQuantTableLen);
    memcpy(out.quant_tables + kQuantTableLen, tables.data[chroma_id], kQuantTableLen);
    if (out.restart_interval != 0) {
        out.type = static_cast<uint8_t>(out.type + kTypeRestartFlag);
    }
    out.width = sof.width;
    out.height = sof.height;
    return Error::Ok;
}

}  // namespace

const char* error_name(Error e) {
    switch (e) {
        case Error::Ok:
            return "ok";
        case Error::NotJpeg:
            return "not a JPEG";
        case Error::Truncated:
            return "truncated";
        case Error::UnsupportedFrame:
            return "not baseline 8-bit";
        case Error::UnsupportedPrecision:
            return "16-bit quantization table";
        case Error::UnsupportedSampling:
            return "unsupported chroma sampling";
        case Error::UnsupportedDimensions:
            return "unsupported dimensions";
        case Error::MissingTables:
            return "missing quantization table";
        case Error::MissingFrame:
            return "missing SOF0";
        case Error::MissingScan:
            return "missing SOS";
    }
    return "unknown";
}

Error parse(const uint8_t* jpeg, size_t len, Frame& out) {
    out = Frame{};
    if (jpeg == nullptr || len < kMarkerLen || jpeg[0] != kMarkerPrefix || jpeg[1] != kSoi) {
        return Error::NotJpeg;
    }
    QuantTables tables;
    FrameHeader sof;
    size_t pos = kMarkerLen;
    while (pos + kMarkerLen <= len) {
        if (jpeg[pos] != kMarkerPrefix) {
            return Error::NotJpeg;
        }
        const uint8_t marker = jpeg[pos + 1];
        if (marker == kMarkerPrefix) {  // fill byte before a marker
            pos++;
            continue;
        }
        if (is_standalone(marker)) {
            pos += kMarkerLen;
            continue;
        }
        if (marker == kEoi) {
            return Error::MissingScan;
        }
        if (len - pos < kMarkerLen + kSegmentLengthLen) {
            return Error::Truncated;
        }
        const size_t seg_len = read_be16(jpeg + pos + kMarkerLen);
        if (seg_len < kSegmentLengthLen || len - pos - kMarkerLen < seg_len) {
            return Error::Truncated;
        }
        const uint8_t* seg = jpeg + pos + kMarkerLen + kSegmentLengthLen;
        const size_t body_len = seg_len - kSegmentLengthLen;
        Error err = Error::Ok;
        if (marker == kDqt) {
            err = parse_dqt(seg, body_len, tables);
        } else if (marker == kSof0) {
            err = parse_sof0(seg, body_len, sof);
        } else if (is_unsupported_sof(marker)) {
            err = Error::UnsupportedFrame;
        } else if (marker == kDht) {
            err = check_dht(seg, body_len, out.standard_huffman);
        } else if (marker == kDri) {
            err = body_len >= sizeof(uint16_t) ? Error::Ok : Error::Truncated;
            if (err == Error::Ok) {
                out.restart_interval = read_be16(seg);
            }
        }
        if (err != Error::Ok) {
            return err;
        }
        pos += kMarkerLen + seg_len;
        if (marker != kSos) {
            continue;
        }
        if (!sof.present) {
            return Error::MissingFrame;
        }
        err = fill_frame(sof, tables, out);
        if (err != Error::Ok) {
            return err;
        }
        size_t eoi = 0;
        err = find_eoi(jpeg, len, pos, eoi);
        if (err != Error::Ok) {
            return err;
        }
        if (eoi == pos) {
            return Error::Truncated;
        }
        out.scan = jpeg + pos;
        out.scan_len = eoi - pos;
        return Error::Ok;
    }
    return Error::Truncated;
}

Packetizer::Packetizer(const Frame& frame, size_t max_payload) : frame_(frame), max_payload_(max_payload) {}

bool Packetizer::next(uint8_t* dst, size_t cap, size_t& written, bool& last) {
    written = 0;
    last = false;
    if (done()) {
        return false;
    }
    const bool has_restart = frame_.restart_interval != 0;
    const bool first = offset_ == 0;
    const size_t header_len = kMainHeaderLen + (has_restart ? kRestartHeaderLen : 0) +
                              (first ? kQuantHeaderLen + kQuantTablesLen : 0);
    const size_t limit = std::min(cap, max_payload_);
    if (limit <= header_len) {
        return false;
    }

    uint8_t* p = dst;
    *p++ = 0;  // type-specific
    *p++ = static_cast<uint8_t>(offset_ >> 16);
    *p++ = static_cast<uint8_t>(offset_ >> 8);
    *p++ = static_cast<uint8_t>(offset_);
    *p++ = frame_.type;
    *p++ = kQInBandTables;
    *p++ = static_cast<uint8_t>((frame_.width + kPixelsPerUnit - 1) / kPixelsPerUnit);
    *p++ = static_cast<uint8_t>((frame_.height + kPixelsPerUnit - 1) / kPixelsPerUnit);
    if (has_restart) {
        *p++ = static_cast<uint8_t>(frame_.restart_interval >> 8);
        *p++ = static_cast<uint8_t>(frame_.restart_interval);
        *p++ = static_cast<uint8_t>(kRestartFirstLastBits | (kRestartCountUnaligned >> 8));
        *p++ = static_cast<uint8_t>(kRestartCountUnaligned & 0xFF);
    }
    if (first) {
        *p++ = 0;  // MBZ
        *p++ = 0;  // precision: both tables 8-bit
        *p++ = static_cast<uint8_t>(kQuantTablesLen >> 8);
        *p++ = static_cast<uint8_t>(kQuantTablesLen & 0xFF);
        memcpy(p, frame_.quant_tables, kQuantTablesLen);
        p += kQuantTablesLen;
    }
    const size_t chunk = std::min(limit - header_len, frame_.scan_len - offset_);
    memcpy(p, frame_.scan + offset_, chunk);
    offset_ += chunk;
    written = header_len + chunk;
    last = done();
    return true;
}

}  // namespace rtp_jpeg
