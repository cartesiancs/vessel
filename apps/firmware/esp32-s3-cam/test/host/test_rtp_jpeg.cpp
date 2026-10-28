// Unit tests for rtp_jpeg. Extra arguments are JPEG files (e.g. real camera frames) that must
// parse and round-trip through the packetizer.

#include <cstdio>
#include <cstring>
#include <fstream>
#include <iterator>
#include <vector>

#include "rtp_header.hpp"
#include "rtp_jpeg.hpp"

namespace {

int g_failures = 0;

#define CHECK(cond)                                                    \
    do {                                                               \
        if (!(cond)) {                                                 \
            std::printf("FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
            g_failures++;                                              \
        }                                                              \
    } while (0)

using Bytes = std::vector<uint8_t>;

void put16(Bytes& b, uint16_t v) {
    b.push_back(static_cast<uint8_t>(v >> 8));
    b.push_back(static_cast<uint8_t>(v));
}

void put_segment(Bytes& b, uint8_t marker, const Bytes& body) {
    b.push_back(0xFF);
    b.push_back(marker);
    put16(b, static_cast<uint16_t>(body.size() + 2));
    b.insert(b.end(), body.begin(), body.end());
}

struct Synthetic {
    uint8_t dqt_precision = 0;
    uint8_t sof_marker = 0xC0;
    uint16_t width = 64;
    uint16_t height = 48;
    uint8_t y_sampling = 0x21;
    uint16_t restart_interval = 0;
    bool nonstandard_dht = false;
    bool with_eoi = true;
};

const Bytes kScan = {0x12, 0xFF, 0x00, 0x34, 0xFF, 0xD0, 0x56, 0x78, 0xFF, 0x00};

Bytes make_jpeg(const Synthetic& s) {
    Bytes b = {0xFF, 0xD8};
    put_segment(b, 0xE0, {'J', 'F', 'I', 'F', 0, 1, 1, 0, 0, 1, 0, 1, 0, 0});
    for (uint8_t id = 0; id < 2; id++) {
        Bytes dqt = {static_cast<uint8_t>((s.dqt_precision << 4) | id)};
        const size_t entries = s.dqt_precision == 0 ? 64 : 128;
        for (size_t i = 0; i < entries; i++) {
            dqt.push_back(static_cast<uint8_t>(id * 100 + i % 64 + 1));
        }
        put_segment(b, 0xDB, dqt);
    }
    Bytes sof = {8};
    put16(sof, s.height);
    put16(sof, s.width);
    sof.insert(sof.end(), {3, 1, s.y_sampling, 0, 2, 0x11, 1, 3, 0x11, 1});
    put_segment(b, s.sof_marker, sof);
    if (s.nonstandard_dht) {
        Bytes dht = {0x00, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5};
        put_segment(b, 0xC4, dht);
    }
    if (s.restart_interval != 0) {
        Bytes dri;
        put16(dri, s.restart_interval);
        put_segment(b, 0xDD, dri);
    }
    put_segment(b, 0xDA, {3, 1, 0x00, 2, 0x11, 3, 0x11, 0, 63, 0});
    b.insert(b.end(), kScan.begin(), kScan.end());
    if (s.with_eoi) {
        b.insert(b.end(), {0xFF, 0xD9});
    }
    b.insert(b.end(), {0, 0, 0});  // the camera driver may leave padding after EOI
    return b;
}

struct Packet {
    Bytes payload;
    bool last;
};

std::vector<Packet> packetize(const rtp_jpeg::Frame& f, size_t max_payload) {
    std::vector<Packet> out;
    rtp_jpeg::Packetizer p(f, max_payload);
    uint8_t buf[rtp::kMaxPayload];
    size_t written = 0;
    bool last = false;
    while (p.next(buf, sizeof(buf), written, last)) {
        out.push_back({Bytes(buf, buf + written), last});
    }
    return out;
}

uint32_t offset_of(const Bytes& payload) {
    return (static_cast<uint32_t>(payload[1]) << 16) | (payload[2] << 8) | payload[3];
}

// Checks the RFC 2435 headers of every packet and that the scan data reassembles exactly.
void check_round_trip(const rtp_jpeg::Frame& f, size_t max_payload) {
    const std::vector<Packet> packets = packetize(f, max_payload);
    CHECK(!packets.empty());
    const size_t restart_len = f.restart_interval != 0 ? rtp_jpeg::kRestartHeaderLen : 0;
    Bytes scan;
    for (size_t i = 0; i < packets.size(); i++) {
        const Bytes& pl = packets[i].payload;
        CHECK(pl.size() <= max_payload);
        CHECK(packets[i].last == (i + 1 == packets.size()));
        CHECK(offset_of(pl) == scan.size());
        CHECK(pl[4] == f.type);
        CHECK(pl[5] == rtp_jpeg::kQInBandTables);
        CHECK(pl[6] == (f.width + 7) / 8);
        CHECK(pl[7] == (f.height + 7) / 8);
        size_t data = rtp_jpeg::kMainHeaderLen + restart_len;
        if (restart_len != 0) {
            CHECK(((pl[8] << 8) | pl[9]) == f.restart_interval);
            CHECK(pl[10] == 0xFF && pl[11] == 0xFF);
        }
        if (i == 0) {
            CHECK(pl[data] == 0 && pl[data + 1] == 0);
            CHECK(((pl[data + 2] << 8) | pl[data + 3]) == rtp_jpeg::kQuantTablesLen);
            CHECK(memcmp(&pl[data + 4], f.quant_tables, rtp_jpeg::kQuantTablesLen) == 0);
            data += rtp_jpeg::kQuantHeaderLen + rtp_jpeg::kQuantTablesLen;
        }
        scan.insert(scan.end(), pl.begin() + static_cast<long>(data), pl.end());
    }
    CHECK(scan.size() == f.scan_len);
    CHECK(memcmp(scan.data(), f.scan, f.scan_len) == 0);
}

void test_synthetic_422() {
    const Bytes jpeg = make_jpeg({});
    rtp_jpeg::Frame f;
    CHECK(rtp_jpeg::parse(jpeg.data(), jpeg.size(), f) == rtp_jpeg::Error::Ok);
    CHECK(f.type == rtp_jpeg::kTypeYuv422);
    CHECK(f.width == 64 && f.height == 48);
    CHECK(f.standard_huffman);
    CHECK(f.scan_len == kScan.size());
    CHECK(memcmp(f.scan, kScan.data(), kScan.size()) == 0);
    CHECK(f.quant_tables[0] == 1 && f.quant_tables[64] == 101);
    check_round_trip(f, rtp::kMaxPayload);
}

void test_synthetic_420_restart() {
    Synthetic s;
    s.y_sampling = 0x22;
    s.restart_interval = 4;
    const Bytes jpeg = make_jpeg(s);
    rtp_jpeg::Frame f;
    CHECK(rtp_jpeg::parse(jpeg.data(), jpeg.size(), f) == rtp_jpeg::Error::Ok);
    CHECK(f.type == rtp_jpeg::kTypeYuv420 + rtp_jpeg::kTypeRestartFlag);
    CHECK(f.restart_interval == 4);
    check_round_trip(f, rtp::kMaxPayload);
}

void test_small_payload_splits() {
    const Bytes jpeg = make_jpeg({});
    rtp_jpeg::Frame f;
    CHECK(rtp_jpeg::parse(jpeg.data(), jpeg.size(), f) == rtp_jpeg::Error::Ok);
    // Room for the first packet's tables plus 3 scan bytes, then 3-byte chunks.
    const size_t first = rtp_jpeg::kMainHeaderLen + rtp_jpeg::kQuantHeaderLen + rtp_jpeg::kQuantTablesLen + 3;
    rtp_jpeg::Packetizer p(f, first);
    uint8_t buf[rtp::kMaxPayload];
    size_t written = 0;
    bool last = false;
    size_t count = 0;
    bool ended_with_marker = false;
    while (p.next(buf, sizeof(buf), written, last)) {
        count++;
        ended_with_marker = last;
    }
    CHECK(count > 1);
    CHECK(ended_with_marker);
    check_round_trip(f, first);

    rtp_jpeg::Packetizer tiny(f, rtp_jpeg::kMainHeaderLen);
    CHECK(!tiny.next(buf, sizeof(buf), written, last));
}

void expect_error(const Bytes& jpeg, rtp_jpeg::Error want, const char* what) {
    rtp_jpeg::Frame f;
    const rtp_jpeg::Error got = rtp_jpeg::parse(jpeg.data(), jpeg.size(), f);
    if (got != want) {
        std::printf("FAIL %s: got '%s', want '%s'\n", what, rtp_jpeg::error_name(got), rtp_jpeg::error_name(want));
        g_failures++;
    }
}

void test_errors() {
    using rtp_jpeg::Error;
    expect_error({}, Error::NotJpeg, "empty");
    expect_error({0x89, 'P', 'N', 'G'}, Error::NotJpeg, "png");

    Synthetic s;
    s.dqt_precision = 1;
    expect_error(make_jpeg(s), Error::UnsupportedPrecision, "16-bit DQT");

    s = {};
    s.y_sampling = 0x11;
    expect_error(make_jpeg(s), Error::UnsupportedSampling, "4:4:4");

    s = {};
    s.sof_marker = 0xC2;
    expect_error(make_jpeg(s), Error::UnsupportedFrame, "progressive");

    s = {};
    s.width = 2048;
    expect_error(make_jpeg(s), Error::UnsupportedDimensions, "QXGA width");

    s = {};
    s.with_eoi = false;
    expect_error(make_jpeg(s), Error::Truncated, "no EOI");

    const Bytes full = make_jpeg({});
    for (size_t cut : {size_t{3}, size_t{20}, size_t{100}, full.size() / 2}) {
        expect_error(Bytes(full.begin(), full.begin() + static_cast<long>(cut)), Error::Truncated, "cut");
    }
}

void test_nonstandard_huffman() {
    Synthetic s;
    s.nonstandard_dht = true;
    const Bytes jpeg = make_jpeg(s);
    rtp_jpeg::Frame f;
    CHECK(rtp_jpeg::parse(jpeg.data(), jpeg.size(), f) == rtp_jpeg::Error::Ok);
    CHECK(!f.standard_huffman);
}

void test_file(const char* path) {
    std::ifstream in(path, std::ios::binary);
    const Bytes jpeg((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    rtp_jpeg::Frame f;
    const rtp_jpeg::Error err = rtp_jpeg::parse(jpeg.data(), jpeg.size(), f);
    std::printf("%s: %zu bytes, %s, type %u, %ux%u, restart %u, standard huffman %d, %zu packets\n", path,
                jpeg.size(), rtp_jpeg::error_name(err), f.type, f.width, f.height, f.restart_interval,
                f.standard_huffman, packetize(f, rtp::kMaxPayload).size());
    CHECK(err == rtp_jpeg::Error::Ok);
    CHECK(f.standard_huffman);
    check_round_trip(f, rtp::kMaxPayload);

    const Bytes half(jpeg.begin(), jpeg.begin() + static_cast<long>(jpeg.size() / 2));
    expect_error(half, rtp_jpeg::Error::Truncated, path);
}

}  // namespace

int main(int argc, char** argv) {
    test_synthetic_422();
    test_synthetic_420_restart();
    test_small_payload_splits();
    test_errors();
    test_nonstandard_huffman();
    for (int i = 1; i < argc; i++) {
        test_file(argv[i]);
    }
    if (g_failures != 0) {
        std::printf("%d check(s) failed\n", g_failures);
        return 1;
    }
    std::printf("all rtp_jpeg tests passed\n");
    return 0;
}
