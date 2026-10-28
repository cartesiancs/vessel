// Build-time network configuration (from secrets.h) and camera/mic settings persisted in NVS.
#pragma once

#include <cstddef>
#include <cstdint>

#include "esp_err.h"

struct Settings {
    int framesize = 0;
    int quality = 12;
    int brightness = 0;
    int contrast = 0;
    int saturation = 0;
    int vflip = 0;
    int hmirror = 0;
    int mic_gain = 8;
};

struct NetworkConfig {
    const char* wifi_ssid;
    const char* wifi_password;
    const char* host;
    uint16_t http_port;
    const char* device_id;
    const char* device_token;
    const char* topic_base;
};

namespace config {

// Topics are "<base>/video" and "<base>/audio"; the server caps topics at 128 characters.
inline constexpr size_t kMaxTopicLen = 128;
inline constexpr size_t kMaxTopicSuffixLen = 6;  // "/video"
inline constexpr size_t kMaxTopicBaseLen = kMaxTopicLen - kMaxTopicSuffixLen;
inline constexpr size_t kMaxHostLen = 63;
inline constexpr size_t kMaxDeviceIdLen = 64;
inline constexpr size_t kMaxTokenLen = 128;

const NetworkConfig& network();

}  // namespace config

namespace settings {

// Initializes NVS and loads the stored settings. Returns true if they came from flash,
// false if this is a first boot and the defaults are in use.
bool init();

Settings get();

// Updates the settings and writes them to flash after a short debounce.
void save(const Settings& s);

}  // namespace settings
