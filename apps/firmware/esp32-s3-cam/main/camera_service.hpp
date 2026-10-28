// DVP camera driver setup and sensor controls. Frames are pulled by video_tx.
#pragma once

#include "esp_err.h"

namespace camera {

// Must run before Wi-Fi init: the driver needs a contiguous internal DMA buffer.
// `settings_loaded` false applies sensor-specific defaults and stores them.
esp_err_t init(bool settings_loaded);

const char* sensor_name();

}  // namespace camera
