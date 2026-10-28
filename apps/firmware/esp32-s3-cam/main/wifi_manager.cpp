#include "wifi_manager.hpp"

#include <atomic>
#include <cstdio>
#include <cstring>

#include "config.hpp"
#include "esp_check.h"
#include "esp_event.h"
#include "esp_log.h"
#include "esp_netif.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"

namespace {

constexpr const char* TAG = "wifi";
constexpr EventBits_t kConnectedBit = BIT0;
constexpr EventBits_t kDisconnectedBit = BIT1;

EventGroupHandle_t g_events;
esp_netif_t* g_netif;
std::atomic<uint32_t> g_epoch{0};

void reconnect() {
    const esp_err_t err = esp_wifi_connect();
    if (err != ESP_OK) {
        ESP_LOGE(TAG, "esp_wifi_connect failed: %s", esp_err_to_name(err));
    }
}

void on_event(void*, esp_event_base_t base, int32_t id, void* data) {
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) {
        reconnect();
    } else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) {
        const auto* e = static_cast<wifi_event_sta_disconnected_t*>(data);
        ESP_LOGW(TAG, "disconnected (reason %d), reconnecting", e->reason);
        xEventGroupClearBits(g_events, kConnectedBit);
        xEventGroupSetBits(g_events, kDisconnectedBit);
        reconnect();
    } else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        const auto* e = static_cast<ip_event_got_ip_t*>(data);
        ESP_LOGI(TAG, "connected to \"%s\", ip " IPSTR, config::network().wifi_ssid, IP2STR(&e->ip_info.ip));
        g_epoch++;
        xEventGroupClearBits(g_events, kDisconnectedBit);
        xEventGroupSetBits(g_events, kConnectedBit);
    }
}

bool wait_bit(EventBits_t bit, uint32_t timeout_ms) {
    return (xEventGroupWaitBits(g_events, bit, pdFALSE, pdTRUE, pdMS_TO_TICKS(timeout_ms)) & bit) != 0;
}

}  // namespace

esp_err_t wifi::start() {
    g_events = xEventGroupCreate();
    if (g_events == nullptr) {
        return ESP_ERR_NO_MEM;
    }
    xEventGroupSetBits(g_events, kDisconnectedBit);
    ESP_RETURN_ON_ERROR(esp_netif_init(), TAG, "netif init");
    ESP_RETURN_ON_ERROR(esp_event_loop_create_default(), TAG, "event loop");
    g_netif = esp_netif_create_default_wifi_sta();
    if (g_netif == nullptr) {
        return ESP_FAIL;
    }
    ESP_RETURN_ON_ERROR(esp_netif_set_hostname(g_netif, kHostname), TAG, "hostname");

    wifi_init_config_t init_cfg = WIFI_INIT_CONFIG_DEFAULT();
    ESP_RETURN_ON_ERROR(esp_wifi_init(&init_cfg), TAG, "wifi init");
    ESP_RETURN_ON_ERROR(esp_wifi_set_storage(WIFI_STORAGE_RAM), TAG, "storage");
    ESP_RETURN_ON_ERROR(esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, on_event, nullptr), TAG,
                        "wifi handler");
    ESP_RETURN_ON_ERROR(esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_event, nullptr), TAG,
                        "ip handler");

    const NetworkConfig& net = config::network();
    wifi_config_t cfg = {};
    strlcpy(reinterpret_cast<char*>(cfg.sta.ssid), net.wifi_ssid, sizeof(cfg.sta.ssid));
    strlcpy(reinterpret_cast<char*>(cfg.sta.password), net.wifi_password, sizeof(cfg.sta.password));
    cfg.sta.scan_method = WIFI_ALL_CHANNEL_SCAN;
    cfg.sta.sort_method = WIFI_CONNECT_AP_BY_SIGNAL;
    // Refuse a look-alike open/WEP/WPA network with the same SSID.
    cfg.sta.threshold.authmode = strlen(net.wifi_password) > 0 ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;
    cfg.sta.pmf_cfg.capable = true;
    ESP_RETURN_ON_ERROR(esp_wifi_set_mode(WIFI_MODE_STA), TAG, "set_mode");
    ESP_RETURN_ON_ERROR(esp_wifi_set_config(WIFI_IF_STA, &cfg), TAG, "set_config");
    ESP_LOGI(TAG, "connecting to \"%s\"", net.wifi_ssid);
    ESP_RETURN_ON_ERROR(esp_wifi_start(), TAG, "start");
    // Power save adds tens of ms of latency to every streamed packet.
    return esp_wifi_set_ps(WIFI_PS_NONE);
}

bool wifi::wait_connected(uint32_t timeout_ms) { return wait_bit(kConnectedBit, timeout_ms); }

bool wifi::wait_disconnected(uint32_t timeout_ms) { return wait_bit(kDisconnectedBit, timeout_ms); }

uint32_t wifi::epoch() { return g_epoch.load(); }

void wifi::ip(char* buf, size_t len) {
    esp_netif_ip_info_t info = {};
    if (g_netif == nullptr || esp_netif_get_ip_info(g_netif, &info) != ESP_OK) {
        snprintf(buf, len, "0.0.0.0");
        return;
    }
    snprintf(buf, len, IPSTR, IP2STR(&info.ip));
}

int wifi::rssi() {
    int value = 0;
    if (esp_wifi_sta_get_rssi(&value) != ESP_OK) {
        return 0;
    }
    return value;
}
