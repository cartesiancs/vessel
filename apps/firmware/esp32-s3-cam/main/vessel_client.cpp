#include "vessel_client.hpp"

#include <cinttypes>
#include <cmath>
#include <cstdio>
#include <cstring>

#include "cJSON.h"
#include "config.hpp"
#include "esp_http_client.h"
#include "esp_log.h"
#include "lwip/netdb.h"

namespace {

constexpr const char* TAG = "vessel";
constexpr const char* kRegisterPath = "/api/streams/register";
// The server verifies the device token with bcrypt (cost 12) on every request, which takes a few
// hundred milliseconds on a small host.
constexpr int kHttpTimeoutMs = 5000;
constexpr size_t kUrlLen = 128;
constexpr size_t kAuthHeaderLen = config::kMaxTokenLen + sizeof("Bearer ");
constexpr size_t kBodyLen = config::kMaxTopicLen + 96;
constexpr size_t kResponseLen = 512;
constexpr int kHttpOkFirst = 200;
constexpr int kHttpOkLast = 299;
constexpr double kMaxSsrc = 4294967295.0;
constexpr double kMaxPort = 65535.0;
constexpr double kIntegerEpsilon = 1e-6;

struct MediaSpec {
    const char* suffix;
    const char* media_type;
    const char* codec;
};

const MediaSpec& spec(vessel::Media media) {
    static constexpr MediaSpec kVideo = {"video", "video", "jpeg"};
    static constexpr MediaSpec kAudio = {"audio", "audio", "opus"};
    return media == vessel::Media::Video ? kVideo : kAudio;
}

bool json_integer(const cJSON* item, double min, double max, double& out) {
    if (!cJSON_IsNumber(item)) {
        return false;
    }
    const double v = item->valuedouble;
    if (v < min || v > max || std::fabs(v - std::nearbyint(v)) > kIntegerEpsilon) {
        return false;
    }
    out = std::nearbyint(v);
    return true;
}

esp_err_t parse_registration(const char* body, vessel::Registration& out) {
    cJSON* root = cJSON_Parse(body);
    if (root == nullptr) {
        return ESP_ERR_INVALID_RESPONSE;
    }
    double ssrc = 0;
    double port = 0;
    const bool ok = json_integer(cJSON_GetObjectItemCaseSensitive(root, "ssrc"), 0, kMaxSsrc, ssrc) &&
                    json_integer(cJSON_GetObjectItemCaseSensitive(root, "rtp_port"), 1, kMaxPort, port);
    cJSON_Delete(root);
    if (!ok) {
        return ESP_ERR_INVALID_RESPONSE;
    }
    out.ssrc = static_cast<uint32_t>(ssrc);
    out.rtp_port = static_cast<uint16_t>(port);
    return ESP_OK;
}

// Runs one POST and reads the body into `response`. `status` receives the HTTP status code.
esp_err_t post_json(const char* url, const char* body, char* response, size_t response_cap, int& status) {
    const NetworkConfig& net = config::network();
    char auth[kAuthHeaderLen];
    const int auth_len = snprintf(auth, sizeof(auth), "Bearer %s", net.device_token);
    if (auth_len < 0 || static_cast<size_t>(auth_len) >= sizeof(auth)) {
        return ESP_ERR_INVALID_SIZE;
    }

    esp_http_client_config_t cfg = {};
    cfg.url = url;
    cfg.method = HTTP_METHOD_POST;
    cfg.timeout_ms = kHttpTimeoutMs;
    cfg.disable_auto_redirect = true;
    esp_http_client_handle_t client = esp_http_client_init(&cfg);
    if (client == nullptr) {
        return ESP_ERR_NO_MEM;
    }

    esp_err_t err = esp_http_client_set_header(client, "Content-Type", "application/json");
    if (err == ESP_OK) {
        err = esp_http_client_set_header(client, "Authorization", auth);
    }
    if (err == ESP_OK) {
        err = esp_http_client_set_header(client, "X-Device-Id", net.device_id);
    }
    const int body_len = static_cast<int>(strlen(body));
    bool opened = false;
    if (err == ESP_OK) {
        err = esp_http_client_open(client, body_len);
        opened = err == ESP_OK;
    }
    if (err == ESP_OK && esp_http_client_write(client, body, body_len) != body_len) {
        err = ESP_FAIL;
    }
    if (err == ESP_OK && esp_http_client_fetch_headers(client) < 0) {
        err = ESP_FAIL;
    }
    if (err == ESP_OK) {
        status = esp_http_client_get_status_code(client);
        const int read = esp_http_client_read_response(client, response, static_cast<int>(response_cap - 1));
        if (read < 0) {
            err = ESP_FAIL;
        } else {
            response[read] = '\0';
        }
    }

    // Closing a connection that never opened fails and would add a warning to every retry.
    if (opened) {
        const esp_err_t close_err = esp_http_client_close(client);
        if (close_err != ESP_OK) {
            ESP_LOGW(TAG, "http close failed: %s", esp_err_to_name(close_err));
        }
    }
    const esp_err_t cleanup_err = esp_http_client_cleanup(client);
    if (cleanup_err != ESP_OK) {
        ESP_LOGW(TAG, "http cleanup failed: %s", esp_err_to_name(cleanup_err));
    }
    return err;
}

}  // namespace

namespace vessel {

const char* media_name(Media media) { return spec(media).suffix; }

esp_err_t register_stream(Media media, Registration& out) {
    const NetworkConfig& net = config::network();
    const MediaSpec& s = spec(media);

    char url[kUrlLen];
    const int url_len = snprintf(url, sizeof(url), "http://%s:%u%s", net.host, net.http_port, kRegisterPath);
    // config.cpp validates the topic base at build time, so it needs no JSON escaping.
    char body[kBodyLen];
    const int body_len = snprintf(body, sizeof(body), R"({"topic":"%s/%s","media_type":"%s","codec":"%s"})",
                                  net.topic_base, s.suffix, s.media_type, s.codec);
    if (url_len < 0 || static_cast<size_t>(url_len) >= sizeof(url) || body_len < 0 ||
        static_cast<size_t>(body_len) >= sizeof(body)) {
        return ESP_ERR_INVALID_SIZE;
    }

    char response[kResponseLen];
    int status = 0;
    const esp_err_t err = post_json(url, body, response, sizeof(response), status);
    if (err != ESP_OK) {
        ESP_LOGW(TAG, "register %s: request failed: %s", s.suffix, esp_err_to_name(err));
        return err;
    }
    // The server answers authentication failures with 500, so the status alone can't tell them apart.
    if (status < kHttpOkFirst || status > kHttpOkLast) {
        ESP_LOGW(TAG, "register %s: HTTP %d (check VESSEL_DEVICE_ID / VESSEL_DEVICE_TOKEN): %.120s", s.suffix, status,
                 response);
        return ESP_ERR_INVALID_RESPONSE;
    }
    if (parse_registration(response, out) != ESP_OK) {
        ESP_LOGW(TAG, "register %s: malformed response: %.120s", s.suffix, response);
        return ESP_ERR_INVALID_RESPONSE;
    }
    ESP_LOGI(TAG, "registered %s/%s: ssrc %" PRIu32 ", rtp port %u", net.topic_base, s.suffix, out.ssrc,
             out.rtp_port);
    return ESP_OK;
}

esp_err_t resolve_rtp_destination(uint16_t port, sockaddr_in& out) {
    addrinfo hints = {};
    hints.ai_family = AF_INET;
    hints.ai_socktype = SOCK_DGRAM;
    addrinfo* result = nullptr;
    const int rc = getaddrinfo(config::network().host, nullptr, &hints, &result);
    if (rc != 0 || result == nullptr) {
        ESP_LOGW(TAG, "cannot resolve %s (%d)", config::network().host, rc);
        if (result != nullptr) {
            freeaddrinfo(result);
        }
        return ESP_ERR_NOT_FOUND;
    }
    out = {};
    out.sin_family = AF_INET;
    out.sin_port = htons(port);
    out.sin_addr = reinterpret_cast<const sockaddr_in*>(result->ai_addr)->sin_addr;
    freeaddrinfo(result);
    return ESP_OK;
}

}  // namespace vessel
