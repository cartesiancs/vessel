#include "opus_encoder.hpp"

#include "esp_log.h"
#include "esp_opus_enc.h"

namespace {

constexpr const char* TAG = "opus";
constexpr int kBitrate = 24'000;
// Mid-range complexity; leaves CPU headroom for the camera and Wi-Fi tasks.
constexpr int kComplexity = 5;

const char* audio_err_name(esp_audio_err_t err) {
    switch (err) {
        case ESP_AUDIO_ERR_OK:
            return "ok";
        case ESP_AUDIO_ERR_MEM_LACK:
            return "out of memory";
        case ESP_AUDIO_ERR_DATA_LACK:
            return "not enough data";
        case ESP_AUDIO_ERR_INVALID_PARAMETER:
            return "invalid parameter";
        case ESP_AUDIO_ERR_BUFF_NOT_ENOUGH:
            return "buffer too small";
        default:
            return "failure";
    }
}

}  // namespace

namespace opus {

Encoder::~Encoder() { close(); }

esp_err_t Encoder::open(uint32_t sample_rate, size_t samples_per_frame, size_t max_packet) {
    close();
    esp_opus_enc_config_t cfg = ESP_OPUS_ENC_CONFIG_DEFAULT();
    cfg.sample_rate = static_cast<int>(sample_rate);
    cfg.channel = ESP_AUDIO_MONO;
    cfg.bits_per_sample = ESP_AUDIO_BIT16;
    cfg.bitrate = kBitrate;
    cfg.frame_duration = ESP_OPUS_ENC_FRAME_DURATION_20_MS;
    cfg.application_mode = ESP_OPUS_ENC_APPLICATION_VOIP;
    cfg.complexity = kComplexity;
    cfg.enable_fec = false;
    // DTX would skip frames in silence and break the fixed 20 ms timestamp step.
    cfg.enable_dtx = false;
    cfg.enable_vbr = true;

    esp_audio_err_t err = esp_opus_enc_open(&cfg, sizeof(cfg), &handle_);
    if (err != ESP_AUDIO_ERR_OK || handle_ == nullptr) {
        ESP_LOGE(TAG, "open failed: %s", audio_err_name(err));
        handle_ = nullptr;
        return ESP_FAIL;
    }
    int in_size = 0;
    int out_size = 0;
    err = esp_opus_enc_get_frame_size(handle_, &in_size, &out_size);
    if (err != ESP_AUDIO_ERR_OK) {
        ESP_LOGE(TAG, "frame size query failed: %s", audio_err_name(err));
        close();
        return ESP_FAIL;
    }
    const size_t want_in = samples_per_frame * sizeof(int16_t);
    if (in_size <= 0 || static_cast<size_t>(in_size) != want_in || out_size <= 0 ||
        static_cast<size_t>(out_size) > max_packet) {
        ESP_LOGE(TAG, "unexpected frame sizes: in %d (want %u), out %d (max %u)", in_size,
                 static_cast<unsigned>(want_in), out_size, static_cast<unsigned>(max_packet));
        close();
        return ESP_ERR_INVALID_SIZE;
    }
    in_bytes_ = want_in;
    ESP_LOGI(TAG, "encoder ready: %u Hz mono, %d bps, %u ms frames", static_cast<unsigned>(sample_rate), kBitrate,
             static_cast<unsigned>(kFrameMs));
    return ESP_OK;
}

void Encoder::close() {
    if (handle_ != nullptr) {
        esp_opus_enc_close(handle_);
        handle_ = nullptr;
    }
}

esp_err_t Encoder::encode(const int16_t* pcm, uint8_t* out, size_t cap, size_t& written) {
    written = 0;
    if (handle_ == nullptr) {
        return ESP_ERR_INVALID_STATE;
    }
    esp_audio_enc_in_frame_t in = {};
    in.buffer = reinterpret_cast<uint8_t*>(const_cast<int16_t*>(pcm));
    in.len = static_cast<uint32_t>(in_bytes_);
    esp_audio_enc_out_frame_t result = {};
    result.buffer = out;
    result.len = static_cast<uint32_t>(cap);
    const esp_audio_err_t err = esp_opus_enc_process(handle_, &in, &result);
    if (err != ESP_AUDIO_ERR_OK) {
        ESP_LOGW(TAG, "encode failed: %s", audio_err_name(err));
        return ESP_FAIL;
    }
    if (result.encoded_bytes == 0 || result.encoded_bytes > cap) {
        return ESP_ERR_INVALID_SIZE;
    }
    written = result.encoded_bytes;
    return ESP_OK;
}

}  // namespace opus
