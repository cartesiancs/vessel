// Pin map of the Seeed Studio XIAO ESP32-S3 Sense (camera + microphone expansion board).
#pragma once

#include "driver/gpio.h"

namespace board {

// DVP camera connector (OV2640 / OV3660). No PWDN or RESET lines are routed.
inline constexpr int kCamPwdn = -1;
inline constexpr int kCamReset = -1;
inline constexpr int kCamXclk = 10;
inline constexpr int kCamSda = 40;
inline constexpr int kCamScl = 39;
inline constexpr int kCamD7 = 48;  // Y9
inline constexpr int kCamD6 = 11;  // Y8
inline constexpr int kCamD5 = 12;  // Y7
inline constexpr int kCamD4 = 14;  // Y6
inline constexpr int kCamD3 = 16;  // Y5
inline constexpr int kCamD2 = 18;  // Y4
inline constexpr int kCamD1 = 17;  // Y3
inline constexpr int kCamD0 = 15;  // Y2
inline constexpr int kCamVsync = 38;
inline constexpr int kCamHref = 47;
inline constexpr int kCamPclk = 13;

// MSM261D3526H1CPM PDM microphone.
inline constexpr gpio_num_t kMicClk = GPIO_NUM_42;
inline constexpr gpio_num_t kMicData = GPIO_NUM_41;

}  // namespace board
