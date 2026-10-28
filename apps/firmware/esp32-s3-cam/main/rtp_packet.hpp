// Non-blocking UDP socket for RTP packets.
#pragma once

#include <cstddef>
#include <cstdint>

#include "esp_err.h"
#include "lwip/sockets.h"
#include "rtp_header.hpp"

namespace rtp {

enum class SendResult {
    Sent,
    Dropped,  // the network stack stayed out of buffers; the caller should abandon the frame
    Failed,   // no route / interface down; the link supervisor handles reconnecting
};

class UdpSocket {
public:
    UdpSocket() = default;
    ~UdpSocket();
    UdpSocket(const UdpSocket&) = delete;
    UdpSocket& operator=(const UdpSocket&) = delete;

    esp_err_t open();
    void close();
    SendResult send(const sockaddr_in& dest, const uint8_t* data, size_t len);

private:
    int fd_ = -1;
};

}  // namespace rtp
