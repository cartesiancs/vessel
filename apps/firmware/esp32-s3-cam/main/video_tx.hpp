// Camera frames → RFC 2435 RTP packets → Vessel.
#pragma once

#include "esp_err.h"

namespace video_tx {

// Starts the capture-and-send task. Needs camera::init() and link_supervisor::start() first.
esp_err_t start();

}  // namespace video_tx
