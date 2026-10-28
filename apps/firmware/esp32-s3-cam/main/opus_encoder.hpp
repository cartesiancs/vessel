// Opus encoder for 20 ms blocks of 16 kHz mono PCM (esp_audio_codec).
#pragma once

#include <cstddef>
#include <cstdint>

#include "esp_err.h"

namespace opus {

// RFC 7587: the RTP clock of Opus is always 48 kHz, whatever the input sample rate.
inline constexpr uint32_t kRtpClockRate = 48000;
inline constexpr uint32_t kFrameMs = 20;
inline constexpr uint32_t kRtpTicksPerFrame = kRtpClockRate / 1000 * kFrameMs;

class Encoder {
public:
    Encoder() = default;
    ~Encoder();
    Encoder(const Encoder&) = delete;
    Encoder& operator=(const Encoder&) = delete;

    // `samples_per_frame` must match the encoder's 20 ms frame; `max_packet` is the caller's output capacity.
    esp_err_t open(uint32_t sample_rate, size_t samples_per_frame, size_t max_packet);
    void close();

    // Encodes exactly one frame of samples.
    esp_err_t encode(const int16_t* pcm, uint8_t* out, size_t cap, size_t& written);

private:
    void* handle_ = nullptr;
    size_t in_bytes_ = 0;
};

}  // namespace opus
