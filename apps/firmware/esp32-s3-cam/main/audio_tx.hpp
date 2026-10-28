// Microphone PCM → Opus → RTP → Vessel.
#pragma once

#include "esp_err.h"

namespace audio_tx {

// Starts the encode-and-send task. Needs mic::start() and link_supervisor::start() first.
esp_err_t start();

}  // namespace audio_tx
