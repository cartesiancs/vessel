// Wi-Fi station that keeps reconnecting for the life of the device.
#pragma once

#include <cstddef>
#include <cstdint>

#include "esp_err.h"

namespace wifi {

inline constexpr const char* kHostname = "vessel-cam";

// Starts connecting to the network from secrets.h and returns without waiting for it.
esp_err_t start();

// Block until the station has an IP / has lost it. Return false on timeout.
bool wait_connected(uint32_t timeout_ms);
bool wait_disconnected(uint32_t timeout_ms);

// Incremented on every new IP, so a drop and reconnect between two checks is still noticed.
uint32_t epoch();

void ip(char* buf, size_t len);
int rssi();  // 0 unless connected

}  // namespace wifi
