#include "camera_service.hpp"

#include <algorithm>
#include <iterator>

#include "board_pins.hpp"
#include "config.hpp"
#include "esp_camera.h"
#include "esp_check.h"
#include "esp_log.h"

namespace {

constexpr const char* TAG = "camera";
// The S3 derives XCLK as 160 MHz / integer, so 20 MHz is exact (24 MHz would become 26.67 MHz).
constexpr int kXclkHz = 20'000'000;
// Lower values (= higher quality) overflow the JPEG frame buffer at large sizes.
constexpr int kMinQuality = 6;
constexpr int kMaxQuality = 63;
constexpr framesize_t kDefaultSize = FRAMESIZE_VGA;
// RFC 2435 carries width and height in 8-pixel units in one byte (max 2040), which rules out QXGA.
constexpr framesize_t kLargestSize = FRAMESIZE_UXGA;
constexpr size_t kFrameBuffers = 2;
constexpr int kOv3660FirstBootVflip = 1;
constexpr int kOv3660FirstBootBrightness = 1;
constexpr int kOv3660FirstBootSaturation = -2;

constexpr framesize_t kAllowedSizes[] = {
    FRAMESIZE_QQVGA, FRAMESIZE_QVGA, FRAMESIZE_CIF, FRAMESIZE_HVGA, FRAMESIZE_VGA,
    FRAMESIZE_SVGA,  FRAMESIZE_XGA,  FRAMESIZE_HD,  FRAMESIZE_SXGA, FRAMESIZE_UXGA,
};

using Setter = int (*)(sensor_t*, int);

struct Control {
    const char* name;
    int min;
    int max;
    Setter sensor_t::*setter;
    int Settings::*field;
};

constexpr Control kControls[] = {
    {"quality", kMinQuality, kMaxQuality, &sensor_t::set_quality, &Settings::quality},
    {"brightness", -2, 2, &sensor_t::set_brightness, &Settings::brightness},
    {"contrast", -2, 2, &sensor_t::set_contrast, &Settings::contrast},
    {"saturation", -2, 2, &sensor_t::set_saturation, &Settings::saturation},
    {"vflip", 0, 1, &sensor_t::set_vflip, &Settings::vflip},
    {"hmirror", 0, 1, &sensor_t::set_hmirror, &Settings::hmirror},
};

const char* g_sensor_name = "none";
framesize_t g_max_size = kLargestSize;

bool size_allowed(int size) {
    return size <= g_max_size &&
           std::any_of(std::begin(kAllowedSizes), std::end(kAllowedSizes), [size](framesize_t s) { return s == size; });
}

void check_sensor(int result, const char* what) {
    if (result != 0) {
        ESP_LOGW(TAG, "sensor rejected %s", what);
    }
}

void apply_stored(sensor_t* s, const Settings& cfg) {
    const framesize_t size = size_allowed(cfg.framesize) ? static_cast<framesize_t>(cfg.framesize) : kDefaultSize;
    check_sensor(s->set_framesize(s, size), "framesize");
    for (const Control& c : kControls) {
        check_sensor((s->*c.setter)(s, std::clamp(cfg.*c.field, c.min, c.max)), c.name);
    }
}

void apply_first_boot_defaults(sensor_t* s) {
    if (s->id.PID == OV3660_PID) {
        // The OV3660 comes up upside down and over-saturated.
        check_sensor(s->set_vflip(s, kOv3660FirstBootVflip), "vflip");
        check_sensor(s->set_brightness(s, kOv3660FirstBootBrightness), "brightness");
        check_sensor(s->set_saturation(s, kOv3660FirstBootSaturation), "saturation");
    }
    check_sensor(s->set_framesize(s, kDefaultSize), "framesize");
    check_sensor(s->set_quality(s, Settings{}.quality), "quality");

    Settings cfg = settings::get();
    cfg.framesize = s->status.framesize;
    cfg.quality = s->status.quality;
    cfg.brightness = s->status.brightness;
    cfg.contrast = s->status.contrast;
    cfg.saturation = s->status.saturation;
    cfg.vflip = s->status.vflip;
    cfg.hmirror = s->status.hmirror;
    settings::save(cfg);
}

}  // namespace

esp_err_t camera::init(bool settings_loaded) {
    camera_config_t config = {};
    config.pin_pwdn = board::kCamPwdn;
    config.pin_reset = board::kCamReset;
    config.pin_xclk = board::kCamXclk;
    config.pin_sccb_sda = board::kCamSda;
    config.pin_sccb_scl = board::kCamScl;
    config.pin_d7 = board::kCamD7;
    config.pin_d6 = board::kCamD6;
    config.pin_d5 = board::kCamD5;
    config.pin_d4 = board::kCamD4;
    config.pin_d3 = board::kCamD3;
    config.pin_d2 = board::kCamD2;
    config.pin_d1 = board::kCamD1;
    config.pin_d0 = board::kCamD0;
    config.pin_vsync = board::kCamVsync;
    config.pin_href = board::kCamHref;
    config.pin_pclk = board::kCamPclk;
    config.xclk_freq_hz = kXclkHz;
    config.ledc_timer = LEDC_TIMER_0;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.pixel_format = PIXFORMAT_JPEG;
    // Sizing the buffers for the largest allowed frame keeps every allowed size usable.
    config.frame_size = kLargestSize;
    config.jpeg_quality = Settings{}.quality;
    config.fb_count = kFrameBuffers;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.grab_mode = CAMERA_GRAB_LATEST;
    ESP_RETURN_ON_ERROR(esp_camera_init(&config), TAG, "esp_camera_init");

    sensor_t* s = esp_camera_sensor_get();
    if (s == nullptr) {
        return ESP_ERR_INVALID_STATE;
    }
    if (const camera_sensor_info_t* info = esp_camera_sensor_get_info(&s->id)) {
        g_sensor_name = info->name;
        g_max_size = std::min(info->max_size, kLargestSize);
    }
    ESP_LOGI(TAG, "sensor %s (PID 0x%04x)", g_sensor_name, s->id.PID);

    if (settings_loaded) {
        apply_stored(s, settings::get());
    } else {
        apply_first_boot_defaults(s);
    }
    return ESP_OK;
}

const char* camera::sensor_name() { return g_sensor_name; }
