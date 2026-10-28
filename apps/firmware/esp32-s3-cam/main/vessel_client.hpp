// Vessel server HTTP API used by the device.
#pragma once

#include <cstdint>

#include "esp_err.h"
#include "lwip/sockets.h"

namespace vessel {

enum class Media { Video, Audio };

struct Registration {
    uint32_t ssrc;
    uint16_t rtp_port;
};

// POST /api/streams/register for "<topic base>/video" (codec jpeg) or "<topic base>/audio" (codec opus).
// ESP_ERR_INVALID_RESPONSE on a non-2xx status or a malformed body.
esp_err_t register_stream(Media media, Registration& out);

// Resolves the server host to the IPv4 RTP destination.
esp_err_t resolve_rtp_destination(uint16_t port, sockaddr_in& out);

const char* media_name(Media media);

}  // namespace vessel
