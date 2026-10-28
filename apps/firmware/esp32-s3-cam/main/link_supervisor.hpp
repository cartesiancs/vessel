// Connection state machine: waits for Wi-Fi, registers both streams with Vessel, and publishes
// where to send them. Re-registers after every Wi-Fi reconnect.
#pragma once

#include <cstdint>

#include "esp_err.h"
#include "lwip/sockets.h"
#include "vessel_client.hpp"

namespace link_supervisor {

struct StreamTarget {
    sockaddr_in dest;
    uint32_t ssrc;
    uint32_t generation;  // changes on every registration; senders restart their RTP sequence on change
    bool active;
};

// Creates the per-stream mailboxes and the supervisor task. Call before starting the senders.
esp_err_t start();

// Latest target for a stream; inactive until the first successful registration.
StreamTarget current(vessel::Media media);

}  // namespace link_supervisor
