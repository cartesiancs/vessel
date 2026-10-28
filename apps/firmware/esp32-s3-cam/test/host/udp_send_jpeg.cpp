// Sends a JPEG file as an RFC 2435 RTP stream, the way video_tx does on the device, so a desktop
// GStreamer receiver can check the packets:
//   udp_send_jpeg <frame.jpg> <host> <port> [frames] [ssrc]

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <iterator>
#include <thread>
#include <vector>

#include "rtp_header.hpp"
#include "rtp_jpeg.hpp"

namespace {

constexpr int kDefaultFrames = 30;
constexpr uint32_t kDefaultSsrc = 0x1234;
constexpr uint32_t kClockRate = 90000;
constexpr uint32_t kFps = 15;
constexpr int kArgFile = 1;
constexpr int kArgHost = 2;
constexpr int kArgPort = 3;
constexpr int kArgFrames = 4;
constexpr int kArgSsrc = 5;

}  // namespace

int main(int argc, char** argv) {
    if (argc <= kArgPort) {
        std::fprintf(stderr, "usage: %s <frame.jpg> <host> <port> [frames] [ssrc]\n", argv[0]);
        return 2;
    }
    std::ifstream in(argv[kArgFile], std::ios::binary);
    const std::vector<uint8_t> jpeg((std::istreambuf_iterator<char>(in)), std::istreambuf_iterator<char>());
    rtp_jpeg::Frame frame;
    const rtp_jpeg::Error err = rtp_jpeg::parse(jpeg.data(), jpeg.size(), frame);
    if (err != rtp_jpeg::Error::Ok) {
        std::fprintf(stderr, "parse failed: %s\n", rtp_jpeg::error_name(err));
        return 1;
    }
    const int frames = argc > kArgFrames ? std::atoi(argv[kArgFrames]) : kDefaultFrames;
    const uint32_t ssrc = argc > kArgSsrc ? static_cast<uint32_t>(std::strtoul(argv[kArgSsrc], nullptr, 0)) : kDefaultSsrc;

    sockaddr_in dest = {};
    dest.sin_family = AF_INET;
    dest.sin_port = htons(static_cast<uint16_t>(std::atoi(argv[kArgPort])));
    if (inet_pton(AF_INET, argv[kArgHost], &dest.sin_addr) != 1) {
        std::fprintf(stderr, "bad IPv4 address\n");
        return 1;
    }
    const int fd = socket(AF_INET, SOCK_DGRAM, 0);
    if (fd < 0) {
        std::perror("socket");
        return 1;
    }

    uint16_t seq = 0;
    size_t packets = 0;
    for (int i = 0; i < frames; i++) {
        const uint32_t timestamp = static_cast<uint32_t>(i) * (kClockRate / kFps);
        rtp_jpeg::Packetizer p(frame, rtp::kMaxPayload);
        uint8_t buf[rtp::kMaxPacket];
        size_t written = 0;
        bool last = false;
        while (p.next(buf + rtp::kHeaderLen, sizeof(buf) - rtp::kHeaderLen, written, last)) {
            rtp::write_header(buf, rtp::kPayloadTypeJpeg, last, seq++, timestamp, ssrc);
            const ssize_t sent = sendto(fd, buf, rtp::kHeaderLen + written, 0, reinterpret_cast<sockaddr*>(&dest),
                                        sizeof(dest));
            if (sent < 0) {
                std::perror("sendto");
                close(fd);
                return 1;
            }
            packets++;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(1000 / kFps));
    }
    close(fd);
    std::printf("sent %d frames (%zu packets), %ux%u type %u\n", frames, packets, frame.width, frame.height, frame.type);
    return 0;
}
