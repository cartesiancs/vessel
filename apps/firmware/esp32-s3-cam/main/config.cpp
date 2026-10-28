#include "config.hpp"

#include <mutex>

#include "esp_log.h"
#include "esp_timer.h"
#include "nvs.h"
#include "nvs_flash.h"
#include "secrets.h"  // created from secrets.example.h by main/CMakeLists.txt if missing

namespace {

constexpr size_t text_len(const char* s) {
    size_t n = 0;
    while (s[n] != '\0') {
        ++n;
    }
    return n;
}

// Printable ASCII without spaces: the value goes into an HTTP header line verbatim.
constexpr bool header_safe(const char* s) {
    constexpr char kFirstPrintable = '!';
    constexpr char kLastPrintable = '~';
    for (size_t i = 0; s[i] != '\0'; ++i) {
        if (s[i] < kFirstPrintable || s[i] > kLastPrintable) {
            return false;
        }
    }
    return true;
}

// Mirrors the server's topic validation; ':' is excluded, which also rules out the reserved "::".
constexpr bool topic_char(char c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '.' ||
           c == '/' || c == '-';
}

constexpr bool valid_topic_base(const char* s) {
    for (size_t i = 0; s[i] != '\0'; ++i) {
        if (!topic_char(s[i])) {
            return false;
        }
    }
    const size_t n = text_len(s);
    return n > 0 && n <= config::kMaxTopicBaseLen;
}

static_assert(text_len(WIFI_SSID) > 0, "Set WIFI_SSID in main/secrets.h");
static_assert(text_len(VESSEL_HOST) > 0 && text_len(VESSEL_HOST) <= config::kMaxHostLen,
              "Set VESSEL_HOST in main/secrets.h (IPv4 address or hostname, at most 63 characters)");
static_assert(header_safe(VESSEL_HOST), "VESSEL_HOST must not contain spaces or control characters");
static_assert(VESSEL_HTTP_PORT > 0 && VESSEL_HTTP_PORT <= UINT16_MAX, "VESSEL_HTTP_PORT must be 1-65535");
static_assert(text_len(VESSEL_DEVICE_ID) > 0 && text_len(VESSEL_DEVICE_ID) <= config::kMaxDeviceIdLen,
              "Set VESSEL_DEVICE_ID in main/secrets.h (the device_id registered in Vessel)");
static_assert(header_safe(VESSEL_DEVICE_ID), "VESSEL_DEVICE_ID must be printable ASCII without spaces");
static_assert(text_len(VESSEL_DEVICE_TOKEN) > 0 && text_len(VESSEL_DEVICE_TOKEN) <= config::kMaxTokenLen,
              "Set VESSEL_DEVICE_TOKEN in main/secrets.h (from POST /api/devices/:id/token)");
static_assert(header_safe(VESSEL_DEVICE_TOKEN), "VESSEL_DEVICE_TOKEN must be printable ASCII without spaces");
static_assert(valid_topic_base(VESSEL_TOPIC_BASE),
              "VESSEL_TOPIC_BASE may only use A-Z a-z 0-9 _ . / - and at most 122 characters");

constexpr NetworkConfig kNetwork = {
    WIFI_SSID, WIFI_PASSWORD, VESSEL_HOST, VESSEL_HTTP_PORT, VESSEL_DEVICE_ID, VESSEL_DEVICE_TOKEN, VESSEL_TOPIC_BASE,
};

constexpr const char* TAG = "settings";
constexpr const char* kNamespace = "cam";
constexpr const char* kKey = "settings";
constexpr uint32_t kVersion = 1;
// Flash erases stall the cache, so bursts of changes are coalesced into one write.
constexpr uint64_t kSaveDelayUs = 2'000'000;

struct Blob {
    uint32_t version;
    Settings settings;
};

std::mutex g_mutex;
Settings g_settings;
esp_timer_handle_t g_save_timer;

void write_to_flash(void*) {
    const Blob blob{kVersion, settings::get()};
    nvs_handle_t handle;
    esp_err_t err = nvs_open(kNamespace, NVS_READWRITE, &handle);
    if (err == ESP_OK) {
        err = nvs_set_blob(handle, kKey, &blob, sizeof(blob));
        if (err == ESP_OK) {
            err = nvs_commit(handle);
        }
        nvs_close(handle);
    }
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "save failed: %s", esp_err_to_name(err));
    } else {
        ESP_LOGI(TAG, "saved");
    }
}

}  // namespace

const NetworkConfig& config::network() { return kNetwork; }

bool settings::init() {
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        err = nvs_flash_init();
    }
    ESP_ERROR_CHECK(err);

    esp_timer_create_args_t timer_args = {};
    timer_args.callback = write_to_flash;
    timer_args.name = "settings_save";
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &g_save_timer));

    nvs_handle_t handle;
    if (nvs_open(kNamespace, NVS_READONLY, &handle) != ESP_OK) {
        return false;
    }
    Blob blob = {};
    size_t len = sizeof(blob);
    const bool loaded = nvs_get_blob(handle, kKey, &blob, &len) == ESP_OK && len == sizeof(blob) &&
                        blob.version == kVersion;
    nvs_close(handle);
    if (loaded) {
        std::lock_guard lock(g_mutex);
        g_settings = blob.settings;
    }
    return loaded;
}

Settings settings::get() {
    std::lock_guard lock(g_mutex);
    return g_settings;
}

void settings::save(const Settings& s) {
    {
        std::lock_guard lock(g_mutex);
        g_settings = s;
    }
    // Restarts the debounce; stopping an idle timer reports ESP_ERR_INVALID_STATE, which is expected.
    const esp_err_t stop_err = esp_timer_stop(g_save_timer);
    if (stop_err != ESP_OK && stop_err != ESP_ERR_INVALID_STATE) {
        ESP_LOGW(TAG, "debounce timer stop failed: %s", esp_err_to_name(stop_err));
    }
    const esp_err_t start_err = esp_timer_start_once(g_save_timer, kSaveDelayUs);
    if (start_err != ESP_OK) {
        ESP_LOGE(TAG, "debounce timer start failed: %s", esp_err_to_name(start_err));
    }
}
