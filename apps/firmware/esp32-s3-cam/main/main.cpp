// XIAO ESP32-S3 Sense + OV3660: streams the camera (RFC 2435 MJPEG) and microphone (Opus) to a
// Vessel server over RTP/UDP after registering both streams with the device token.

#include "audio_hub.hpp"
#include "audio_tx.hpp"
#include "camera_service.hpp"
#include "config.hpp"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "link_supervisor.hpp"
#include "mic_service.hpp"
#include "video_tx.hpp"
#include "wifi_manager.hpp"

namespace {

constexpr const char* TAG = "main";
constexpr size_t kBytesPerKb = 1024;

void log_memory(const char* stage) {
    ESP_LOGI(TAG, "%s: internal %u KB free, PSRAM %u KB free", stage,
             static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_INTERNAL) / kBytesPerKb),
             static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_SPIRAM) / kBytesPerKb));
}

void report(esp_err_t err, const char* what) {
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "%s failed: %s", what, esp_err_to_name(err));
    }
}

}  // namespace

extern "C" void app_main() {
    log_memory("boot");
    const bool settings_loaded = settings::init();
    const Settings cfg = settings::get();

    // The camera goes first: it needs a contiguous internal DMA buffer that Wi-Fi would fragment.
    const esp_err_t camera_err = camera::init(settings_loaded);
    report(camera_err, "camera init; continuing without video");

    esp_err_t audio_err = audio_hub::init();
    if (audio_err == ESP_OK) {
        audio_err = mic::start(cfg.mic_gain);
    }
    report(audio_err, "microphone init; continuing without audio");

    if (camera_err != ESP_OK && audio_err != ESP_OK) {
        ESP_LOGE(TAG, "neither camera nor microphone is available; nothing to stream");
    }

    // Network bring-up failures leave the device unable to do anything useful; restart and retry.
    ESP_ERROR_CHECK(wifi::start());
    ESP_ERROR_CHECK(link_supervisor::start());
    if (camera_err == ESP_OK) {
        report(video_tx::start(), "video sender start");
    }
    if (audio_err == ESP_OK) {
        report(audio_tx::start(), "audio sender start");
    }

    const NetworkConfig& net = config::network();
    ESP_LOGI(TAG, "streaming to %s as device \"%s\", topics %s/video and %s/audio", net.host, net.device_id,
             net.topic_base, net.topic_base);
    log_memory("ready");
}
