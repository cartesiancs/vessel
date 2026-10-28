// PDM microphone capture into audio_hub.
#pragma once

#include "esp_err.h"

namespace mic {

inline constexpr int kMinGain = 1;
inline constexpr int kMaxGain = 32;

esp_err_t start(int gain);

// Smoothed RMS level of the processed signal.
float level_dbfs();

}  // namespace mic
