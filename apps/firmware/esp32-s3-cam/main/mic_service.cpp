#include "mic_service.hpp"

#include <algorithm>
#include <atomic>
#include <cinttypes>
#include <cmath>
#include <cstdint>
#include <iterator>

#include "audio_hub.hpp"
#include "board_pins.hpp"
#include "driver/i2s_pdm.h"
#include "esp_check.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

namespace {

constexpr const char* TAG = "mic";
// The PDM-to-PCM filter needs a moment to settle after enabling.
constexpr uint32_t kSettleBlocks = 13;  // ~250 ms
constexpr uint32_t kProbeBlocks = 15;   // ~300 ms
// A slot without a microphone reads back a (near) constant value.
constexpr int kMinProbeSwing = 16;
// The S3 PDM receiver has no hardware high-pass filter, and this mic puts ~90% of its
// idle energy below 150 Hz. A 4th-order Butterworth high-pass at 90 Hz removes DC and that
// rumble (-20 dB at 50 Hz) while leaving the voice band flat.
constexpr float kHighPassHz = 90.0f;
constexpr float kButterworthQ[] = {0.5412f, 1.3066f};
constexpr uint32_t kReadTimeoutMs = 200;
constexpr uint32_t kDmaDescriptors = 8;  // 8 x 20 ms of slack if the task is delayed
constexpr float kPcmMin = -32768.0f;
constexpr float kPcmMax = 32767.0f;
constexpr float kFullScale = 32768.0f;
constexpr float kSilenceDbfs = -120.0f;
constexpr float kLevelSmoothing = 0.8f;
constexpr uint32_t kTaskStack = 4096;
constexpr UBaseType_t kTaskPriority = 12;
constexpr BaseType_t kTaskCore = 1;

// Biquad in transposed direct form II.
struct Biquad {
    float b0, b1, b2, a1, a2;
    float z1 = 0.0f;
    float z2 = 0.0f;

    static Biquad high_pass(float cutoff_hz, float q, float sample_rate) {
        const float w0 = 2.0f * static_cast<float>(M_PI) * cutoff_hz / sample_rate;
        const float c = std::cos(w0);
        const float alpha = std::sin(w0) / (2.0f * q);
        const float a0 = 1.0f + alpha;
        return {(1.0f + c) / 2.0f / a0, -(1.0f + c) / a0, (1.0f + c) / 2.0f / a0, -2.0f * c / a0,
                (1.0f - alpha) / a0};
    }

    float process(float x) {
        const float y = b0 * x + z1;
        z1 = b1 * x - a1 * y + z2;
        z2 = b2 * x - a2 * y;
        return y;
    }
};

i2s_chan_handle_t g_rx;
std::atomic<int> g_gain{mic::kMinGain};  // set by mic::start()
std::atomic<float> g_level_dbfs{kSilenceDbfs};
const char* g_slot = "left";

int16_t g_raw[audio_hub::kBlockSamples];
int16_t g_out[audio_hub::kBlockSamples];

bool read_block(int16_t* buf) {
    size_t bytes = 0;
    return i2s_channel_read(g_rx, buf, audio_hub::kBlockBytes, &bytes, kReadTimeoutMs) == ESP_OK &&
           bytes == audio_hub::kBlockBytes;
}

void discard_blocks(uint32_t count) {
    uint32_t failed = 0;
    for (uint32_t i = 0; i < count; i++) {
        if (!read_block(g_raw)) {
            failed++;
        }
    }
    if (failed != 0) {
        ESP_LOGW(TAG, "%" PRIu32 " of %" PRIu32 " settle reads failed", failed, count);
    }
}

bool slot_has_signal() {
    int lo = INT16_MAX;
    int hi = INT16_MIN;
    for (uint32_t i = 0; i < kProbeBlocks; i++) {
        if (!read_block(g_raw)) {
            continue;
        }
        const auto [mn, mx] = std::minmax_element(std::begin(g_raw), std::end(g_raw));
        lo = std::min<int>(lo, *mn);
        hi = std::max<int>(hi, *mx);
    }
    return hi - lo >= kMinProbeSwing;
}

esp_err_t use_slot(i2s_pdm_slot_mask_t mask) {
    i2s_pdm_rx_slot_config_t slot_cfg =
        I2S_PDM_RX_SLOT_PCM_FMT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO);
    slot_cfg.slot_mask = mask;
    ESP_RETURN_ON_ERROR(i2s_channel_disable(g_rx), TAG, "disable");
    ESP_RETURN_ON_ERROR(i2s_channel_reconfig_pdm_rx_slot(g_rx, &slot_cfg), TAG, "reconfig slot");
    return i2s_channel_enable(g_rx);
}

// The SELECT pin of the mic decides which clock edge carries data; check that the
// default (left) slot actually has a signal and fall back to the right one.
void probe_slot() {
    discard_blocks(kSettleBlocks);
    if (slot_has_signal()) {
        return;
    }
    ESP_LOGW(TAG, "no signal on the left PDM slot, trying right");
    if (use_slot(I2S_PDM_SLOT_RIGHT) == ESP_OK) {
        discard_blocks(kSettleBlocks);
        if (slot_has_signal()) {
            g_slot = "right";
            return;
        }
    }
    ESP_LOGE(TAG, "no signal on either PDM slot; check the microphone");
    const esp_err_t err = use_slot(I2S_PDM_SLOT_LEFT);
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "restoring the left slot failed: %s", esp_err_to_name(err));
    }
}

void mic_task(void*) {
    probe_slot();
    ESP_LOGI(TAG, "capturing %" PRIu32 " Hz on the %s slot", audio_hub::kSampleRate, g_slot);

    Biquad high_pass[] = {
        Biquad::high_pass(kHighPassHz, kButterworthQ[0], audio_hub::kSampleRate),
        Biquad::high_pass(kHighPassHz, kButterworthQ[1], audio_hub::kSampleRate),
    };
    float level = kSilenceDbfs;
    for (;;) {
        if (!read_block(g_raw)) {
            ESP_LOGW(TAG, "i2s read timeout");
            continue;
        }
        const float gain = static_cast<float>(g_gain.load());
        float sum_sq = 0.0f;
        for (size_t i = 0; i < audio_hub::kBlockSamples; i++) {
            const float y = high_pass[1].process(high_pass[0].process(g_raw[i]));
            const float v = std::clamp(y * gain, kPcmMin, kPcmMax);
            g_out[i] = static_cast<int16_t>(v);
            sum_sq += v * v;
        }
        audio_hub::push(g_out);

        const float rms = std::sqrt(sum_sq / audio_hub::kBlockSamples);
        const float dbfs = 20.0f * std::log10(std::max(rms, 1.0f) / kFullScale);
        level = kLevelSmoothing * level + (1.0f - kLevelSmoothing) * dbfs;
        g_level_dbfs = level;
    }
}

}  // namespace

esp_err_t mic::start(int gain) {
    g_gain = std::clamp(gain, kMinGain, kMaxGain);

    // PDM RX is only available on I2S0.
    i2s_chan_config_t chan_cfg = I2S_CHANNEL_DEFAULT_CONFIG(I2S_NUM_0, I2S_ROLE_MASTER);
    chan_cfg.dma_desc_num = kDmaDescriptors;
    chan_cfg.dma_frame_num = audio_hub::kBlockSamples;
    ESP_RETURN_ON_ERROR(i2s_new_channel(&chan_cfg, nullptr, &g_rx), TAG, "i2s_new_channel");

    i2s_pdm_rx_config_t pdm_cfg = {};
    pdm_cfg.clk_cfg = I2S_PDM_RX_CLK_DEFAULT_CONFIG(audio_hub::kSampleRate);
    pdm_cfg.slot_cfg = I2S_PDM_RX_SLOT_PCM_FMT_DEFAULT_CONFIG(I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO);
    pdm_cfg.gpio_cfg.clk = board::kMicClk;
    pdm_cfg.gpio_cfg.din = board::kMicData;
    ESP_RETURN_ON_ERROR(i2s_channel_init_pdm_rx_mode(g_rx, &pdm_cfg), TAG, "init pdm rx");
    ESP_RETURN_ON_ERROR(i2s_channel_enable(g_rx), TAG, "enable");

    if (xTaskCreatePinnedToCore(mic_task, "mic", kTaskStack, nullptr, kTaskPriority, nullptr, kTaskCore) != pdPASS) {
        return ESP_ERR_NO_MEM;
    }
    return ESP_OK;
}

float mic::level_dbfs() { return g_level_dbfs.load(); }
