// PCM ring buffer between the microphone task and the audio sender.
#pragma once

#include <cstddef>
#include <cstdint>

#include "esp_err.h"

namespace audio_hub {

inline constexpr uint32_t kSampleRate = 16000;
inline constexpr size_t kBlockSamples = 320;  // 20 ms
inline constexpr size_t kBlockBytes = kBlockSamples * sizeof(int16_t);

esp_err_t init();

// Called by the single microphone task with kBlockSamples samples.
void push(const int16_t* block);

// Cursor for a new reader: slightly behind live.
uint32_t start_cursor();

// Copies up to `max_blocks` blocks from `cursor` into `dst` and advances the cursor.
// Readers that fell too far behind skip ahead. Returns 0 on timeout.
size_t read(uint32_t& cursor, int16_t* dst, size_t max_blocks, uint32_t timeout_ms);

}  // namespace audio_hub
