#include "link_supervisor.hpp"

#include <algorithm>
#include <cinttypes>

#include "esp_log.h"
#include "esp_random.h"
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "wifi_manager.hpp"

namespace {

constexpr const char* TAG = "link";
constexpr uint32_t kBackoffMinMs = 1000;
constexpr uint32_t kBackoffMaxMs = 60'000;
constexpr uint32_t kJitterPercent = 20;
constexpr uint32_t kPercent = 100;
constexpr uint32_t kWifiWaitMs = 5000;
constexpr uint32_t kStreamingCheckMs = 1000;
constexpr uint32_t kTaskStack = 6144;
constexpr UBaseType_t kTaskPriority = 4;
constexpr BaseType_t kTaskCore = 0;

enum class State { WaitWifi, Register, Backoff, Streaming };

QueueHandle_t g_video_mailbox;
QueueHandle_t g_audio_mailbox;

QueueHandle_t mailbox(vessel::Media media) {
    return media == vessel::Media::Video ? g_video_mailbox : g_audio_mailbox;
}

void publish(vessel::Media media, const link_supervisor::StreamTarget& target) {
    // A length-1 queue with overwrite never fails; the check guards against a misconfigured queue.
    if (xQueueOverwrite(mailbox(media), &target) != pdPASS) {
        ESP_LOGE(TAG, "mailbox overwrite failed");
    }
}

void publish_inactive(uint32_t generation) {
    link_supervisor::StreamTarget idle = {};
    idle.generation = generation;
    idle.active = false;
    publish(vessel::Media::Video, idle);
    publish(vessel::Media::Audio, idle);
}

esp_err_t register_one(vessel::Media media, uint32_t generation, link_supervisor::StreamTarget& out) {
    vessel::Registration reg = {};
    esp_err_t err = vessel::register_stream(media, reg);
    if (err != ESP_OK) {
        return err;
    }
    out = {};
    err = vessel::resolve_rtp_destination(reg.rtp_port, out.dest);
    if (err != ESP_OK) {
        return err;
    }
    out.ssrc = reg.ssrc;
    out.generation = generation;
    out.active = true;
    return ESP_OK;
}

uint32_t with_jitter(uint32_t ms) {
    const uint32_t span = ms * kJitterPercent / kPercent;
    const uint32_t offset = span == 0 ? 0 : esp_random() % (2 * span + 1);
    return ms - span + offset;
}

void supervisor_task(void*) {
    State state = State::WaitWifi;
    uint32_t backoff_ms = kBackoffMinMs;
    uint32_t generation = 0;
    uint32_t registered_epoch = 0;
    for (;;) {
        switch (state) {
            case State::WaitWifi:
                if (wifi::wait_connected(kWifiWaitMs)) {
                    state = State::Register;
                }
                break;

            case State::Register: {
                const uint32_t epoch = wifi::epoch();
                link_supervisor::StreamTarget video = {};
                link_supervisor::StreamTarget audio = {};
                const uint32_t next_generation = generation + 1;
                if (register_one(vessel::Media::Video, next_generation, video) == ESP_OK &&
                    register_one(vessel::Media::Audio, next_generation, audio) == ESP_OK) {
                    generation = next_generation;
                    registered_epoch = epoch;
                    publish(vessel::Media::Video, video);
                    publish(vessel::Media::Audio, audio);
                    backoff_ms = kBackoffMinMs;
                    ESP_LOGI(TAG, "streaming (generation %" PRIu32 ")", generation);
                    state = State::Streaming;
                } else {
                    state = State::Backoff;
                }
                break;
            }

            case State::Backoff: {
                const uint32_t delay_ms = with_jitter(backoff_ms);
                ESP_LOGW(TAG, "registration failed, retrying in %" PRIu32 " ms", delay_ms);
                vTaskDelay(pdMS_TO_TICKS(delay_ms));
                backoff_ms = std::min(backoff_ms * 2, kBackoffMaxMs);
                state = wifi::wait_connected(0) ? State::Register : State::WaitWifi;
                break;
            }

            case State::Streaming:
                if (wifi::wait_disconnected(kStreamingCheckMs) || wifi::epoch() != registered_epoch) {
                    ESP_LOGW(TAG, "Wi-Fi lost; pausing streams until it is back");
                    publish_inactive(generation);
                    state = State::WaitWifi;
                }
                break;
        }
    }
}

}  // namespace

esp_err_t link_supervisor::start() {
    g_video_mailbox = xQueueCreate(1, sizeof(StreamTarget));
    g_audio_mailbox = xQueueCreate(1, sizeof(StreamTarget));
    if (g_video_mailbox == nullptr || g_audio_mailbox == nullptr) {
        return ESP_ERR_NO_MEM;
    }
    publish_inactive(0);
    if (xTaskCreatePinnedToCore(supervisor_task, "link", kTaskStack, nullptr, kTaskPriority, nullptr, kTaskCore) !=
        pdPASS) {
        return ESP_ERR_NO_MEM;
    }
    return ESP_OK;
}

link_supervisor::StreamTarget link_supervisor::current(vessel::Media media) {
    StreamTarget target = {};
    if (xQueuePeek(mailbox(media), &target, 0) != pdPASS) {
        target.active = false;
    }
    return target;
}
