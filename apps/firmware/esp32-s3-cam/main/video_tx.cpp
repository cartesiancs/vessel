#include "video_tx.hpp"

#include <cinttypes>

#include "esp_camera.h"
#include "esp_heap_caps.h"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "link_supervisor.hpp"
#include "rtp_jpeg.hpp"
#include "rtp_packet.hpp"
#include "wifi_manager.hpp"

namespace {

constexpr const char* TAG = "video_tx";
constexpr uint32_t kMaxFps = 15;
constexpr int64_t kUsPerSecond = 1'000'000;
constexpr int64_t kMinFrameIntervalUs = kUsPerSecond / kMaxFps;
constexpr uint64_t kClockRate = 90'000;
constexpr TickType_t kInactiveDelay = pdMS_TO_TICKS(200);
constexpr TickType_t kSocketRetryDelay = pdMS_TO_TICKS(1000);
constexpr int64_t kStatsIntervalUs = 10 * kUsPerSecond;
constexpr uint32_t kTaskStack = 4096;
constexpr UBaseType_t kTaskPriority = 5;
constexpr BaseType_t kTaskCore = 1;
constexpr uint32_t kBytesPerKb = 1024;
constexpr uint32_t kFpsScale = 10;

struct Stats {
    uint32_t captured = 0;  // frames delivered by the camera, sent or not
    uint32_t frames = 0;
    uint64_t bytes = 0;
    uint32_t grab_failures = 0;
    uint32_t parse_errors = 0;
    uint32_t dropped_frames = 0;  // network stack out of buffers mid-frame
    uint32_t send_failures = 0;
};

struct Stream {
    rtp::UdpSocket socket;
    uint32_t generation = 0;
    uint16_t seq = 0;
    uint32_t timestamp_offset = 0;
    bool warned_huffman = false;
    rtp_jpeg::Error last_parse_error = rtp_jpeg::Error::Ok;
};

// Only the video task touches this; static keeps the 1.2 KB off its stack.
uint8_t g_packet[rtp::kMaxPacket];

void send_frame(Stream& stream, const link_supervisor::StreamTarget& target, const camera_fb_t* fb, int64_t now_us,
                Stats& stats) {
    rtp_jpeg::Frame frame;
    const rtp_jpeg::Error err = rtp_jpeg::parse(fb->buf, fb->len, frame);
    if (err != rtp_jpeg::Error::Ok) {
        stats.parse_errors++;
        if (err != stream.last_parse_error) {
            ESP_LOGW(TAG, "dropping frame: %s", rtp_jpeg::error_name(err));
            stream.last_parse_error = err;
        }
        return;
    }
    if (!frame.standard_huffman && !stream.warned_huffman) {
        ESP_LOGW(TAG, "sensor JPEG uses non-standard Huffman tables; receivers will decode garbage");
        stream.warned_huffman = true;
    }

    const uint32_t timestamp =
        stream.timestamp_offset + static_cast<uint32_t>(static_cast<uint64_t>(now_us) * kClockRate / kUsPerSecond);
    rtp_jpeg::Packetizer packetizer(frame, rtp::kMaxPayload);
    size_t written = 0;
    bool last = false;
    while (packetizer.next(g_packet + rtp::kHeaderLen, sizeof(g_packet) - rtp::kHeaderLen, written, last)) {
        rtp::write_header(g_packet, rtp::kPayloadTypeJpeg, last, stream.seq++, timestamp, target.ssrc);
        const rtp::SendResult result = stream.socket.send(target.dest, g_packet, rtp::kHeaderLen + written);
        if (result == rtp::SendResult::Dropped) {
            stats.dropped_frames++;
            return;
        }
        if (result == rtp::SendResult::Failed) {
            stats.send_failures++;
            return;
        }
    }
    stats.frames++;
    stats.bytes += fb->len;
}

uint32_t per_second_x10(uint32_t count, int64_t elapsed_us) {
    return static_cast<uint32_t>(static_cast<int64_t>(count) * kFpsScale * kUsPerSecond /
                                 (elapsed_us > 0 ? elapsed_us : 1));
}

void log_stats(Stats& stats, int64_t elapsed_us) {
    const uint32_t fps_x10 = per_second_x10(stats.frames, elapsed_us);
    const uint32_t captured_x10 = per_second_x10(stats.captured, elapsed_us);
    const uint32_t avg_kb = stats.frames != 0 ? static_cast<uint32_t>(stats.bytes / stats.frames / kBytesPerKb) : 0;
    ESP_LOGI(TAG,
             "%" PRIu32 ".%" PRIu32 " fps (camera %" PRIu32 ".%" PRIu32 " fps), %" PRIu32
             " KB/frame, dropped %" PRIu32 ", send errors %" PRIu32 ", parse errors %" PRIu32
             ", grab failures %" PRIu32 ", rssi %d, heap %u KB, psram %u KB",
             fps_x10 / kFpsScale, fps_x10 % kFpsScale, captured_x10 / kFpsScale, captured_x10 % kFpsScale, avg_kb,
             stats.dropped_frames, stats.send_failures, stats.parse_errors, stats.grab_failures, wifi::rssi(),
             static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_INTERNAL) / kBytesPerKb),
             static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_SPIRAM) / kBytesPerKb));
    stats = Stats{};
}

void video_task(void*) {
    Stream stream;
    while (stream.socket.open() != ESP_OK) {
        vTaskDelay(kSocketRetryDelay);
    }
    Stats stats;
    int64_t stats_start_us = esp_timer_get_time();
    int64_t last_sent_us = 0;
    for (;;) {
        const int64_t loop_us = esp_timer_get_time();
        if (loop_us - stats_start_us >= kStatsIntervalUs) {
            log_stats(stats, loop_us - stats_start_us);
            stats_start_us = loop_us;
        }

        const link_supervisor::StreamTarget target = link_supervisor::current(vessel::Media::Video);
        if (!target.active) {
            vTaskDelay(kInactiveDelay);
            continue;
        }
        if (target.generation != stream.generation) {
            stream.generation = target.generation;
            stream.seq = static_cast<uint16_t>(esp_random());
            stream.timestamp_offset = esp_random();
        }

        camera_fb_t* fb = esp_camera_fb_get();  // waits up to 4 s internally
        if (fb == nullptr) {
            stats.grab_failures++;
            continue;
        }
        stats.captured++;
        const int64_t now_us = esp_timer_get_time();
        if (now_us - last_sent_us >= kMinFrameIntervalUs) {
            last_sent_us = now_us;
            send_frame(stream, target, fb, now_us, stats);
        }
        esp_camera_fb_return(fb);
    }
}

}  // namespace

esp_err_t video_tx::start() {
    if (xTaskCreatePinnedToCore(video_task, "video_tx", kTaskStack, nullptr, kTaskPriority, nullptr, kTaskCore) !=
        pdPASS) {
        return ESP_ERR_NO_MEM;
    }
    return ESP_OK;
}
