#include "audio_tx.hpp"

#include <cinttypes>

#include "audio_hub.hpp"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "link_supervisor.hpp"
#include "mic_service.hpp"
#include "opus_encoder.hpp"
#include "rtp_packet.hpp"

namespace {

constexpr const char* TAG = "audio_tx";
constexpr uint32_t kReadTimeoutMs = 200;
constexpr TickType_t kSocketRetryDelay = pdMS_TO_TICKS(1000);
constexpr int64_t kStatsIntervalUs = 30'000'000;
// esp_audio_codec asks for ~40 KB of stack to cover its heaviest encoder. The high-water mark is
// logged with the stats so this can be trimmed after bring-up.
constexpr uint32_t kTaskStack = 40 * 1024;
constexpr UBaseType_t kTaskPriority = 6;
constexpr BaseType_t kTaskCore = 0;

struct Stats {
    uint32_t packets = 0;
    uint32_t encode_errors = 0;
    uint32_t dropped = 0;
    uint32_t send_failures = 0;
};

uint8_t g_packet[rtp::kMaxPacket];
int16_t g_pcm[audio_hub::kBlockSamples];

void log_stats(Stats& stats) {
    ESP_LOGI(TAG,
             "%" PRIu32 " packets, encode errors %" PRIu32 ", dropped %" PRIu32 ", send errors %" PRIu32
             ", level %.1f dBFS, stack headroom %u B",
             stats.packets, stats.encode_errors, stats.dropped, stats.send_failures, static_cast<double>(mic::level_dbfs()),
             static_cast<unsigned>(uxTaskGetStackHighWaterMark(nullptr)));
    stats = Stats{};
}

void audio_task(void*) {
    opus::Encoder encoder;
    const esp_err_t err =
        encoder.open(audio_hub::kSampleRate, audio_hub::kBlockSamples, sizeof(g_packet) - rtp::kHeaderLen);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "Opus encoder unavailable (%s); audio disabled", esp_err_to_name(err));
        vTaskDelete(nullptr);
        return;
    }
    rtp::UdpSocket socket;
    while (socket.open() != ESP_OK) {
        vTaskDelay(kSocketRetryDelay);
    }

    Stats stats;
    int64_t stats_start_us = esp_timer_get_time();
    uint32_t generation = 0;
    uint16_t seq = 0;
    uint32_t timestamp = 0;
    uint32_t cursor = audio_hub::start_cursor();
    for (;;) {
        const int64_t now_us = esp_timer_get_time();
        if (now_us - stats_start_us >= kStatsIntervalUs) {
            log_stats(stats);
            stats_start_us = now_us;
        }
        // Reading even while inactive keeps the cursor live, so streaming resumes without old audio.
        if (audio_hub::read(cursor, g_pcm, 1, kReadTimeoutMs) == 0) {
            continue;
        }
        const link_supervisor::StreamTarget target = link_supervisor::current(vessel::Media::Audio);
        if (!target.active) {
            continue;
        }
        if (target.generation != generation) {
            generation = target.generation;
            seq = static_cast<uint16_t>(esp_random());
            timestamp = esp_random();
        }

        size_t written = 0;
        const esp_err_t enc_err =
            encoder.encode(g_pcm, g_packet + rtp::kHeaderLen, sizeof(g_packet) - rtp::kHeaderLen, written);
        const uint32_t frame_timestamp = timestamp;
        timestamp += opus::kRtpTicksPerFrame;  // advances even for a lost frame so the clock stays real-time
        if (enc_err != ESP_OK) {
            stats.encode_errors++;
            continue;
        }
        rtp::write_header(g_packet, rtp::kPayloadTypeOpus, false, seq++, frame_timestamp, target.ssrc);
        const rtp::SendResult result = socket.send(target.dest, g_packet, rtp::kHeaderLen + written);
        if (result == rtp::SendResult::Sent) {
            stats.packets++;
        } else if (result == rtp::SendResult::Dropped) {
            stats.dropped++;
        } else {
            stats.send_failures++;
        }
    }
}

}  // namespace

esp_err_t audio_tx::start() {
    if (xTaskCreatePinnedToCore(audio_task, "audio_tx", kTaskStack, nullptr, kTaskPriority, nullptr, kTaskCore) !=
        pdPASS) {
        return ESP_ERR_NO_MEM;
    }
    return ESP_OK;
}
