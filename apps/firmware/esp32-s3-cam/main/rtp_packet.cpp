#include "rtp_packet.hpp"

#include <cerrno>
#include <fcntl.h>

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace {

constexpr const char* TAG = "rtp";
constexpr int kSendRetries = 3;
constexpr TickType_t kRetryDelay = pdMS_TO_TICKS(1);

bool out_of_buffers(int err) { return err == ENOMEM || err == ENOBUFS || err == EAGAIN || err == EWOULDBLOCK; }

}  // namespace

namespace rtp {

UdpSocket::~UdpSocket() { close(); }

esp_err_t UdpSocket::open() {
    close();
    fd_ = socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP);
    if (fd_ < 0) {
        ESP_LOGE(TAG, "socket failed: errno %d", errno);
        return ESP_FAIL;
    }
    const int flags = fcntl(fd_, F_GETFL, 0);
    if (flags < 0 || fcntl(fd_, F_SETFL, flags | O_NONBLOCK) < 0) {
        ESP_LOGE(TAG, "fcntl O_NONBLOCK failed: errno %d", errno);
        close();
        return ESP_FAIL;
    }
    return ESP_OK;
}

void UdpSocket::close() {
    if (fd_ >= 0) {
        if (::close(fd_) != 0) {
            ESP_LOGW(TAG, "close failed: errno %d", errno);
        }
        fd_ = -1;
    }
}

SendResult UdpSocket::send(const sockaddr_in& dest, const uint8_t* data, size_t len) {
    if (fd_ < 0) {
        return SendResult::Failed;
    }
    // lwIP reports a full TX queue as ENOMEM; the Wi-Fi driver drains it within a millisecond or two.
    for (int attempt = 0; attempt <= kSendRetries; attempt++) {
        const ssize_t sent = sendto(fd_, data, len, 0, reinterpret_cast<const sockaddr*>(&dest), sizeof(dest));
        if (sent == static_cast<ssize_t>(len)) {
            return SendResult::Sent;
        }
        if (sent >= 0 || !out_of_buffers(errno)) {
            return SendResult::Failed;
        }
        vTaskDelay(kRetryDelay);
    }
    return SendResult::Dropped;
}

}  // namespace rtp
