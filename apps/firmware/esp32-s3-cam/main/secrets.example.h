// Template for main/secrets.h (gitignored; created from this file on the first build).
// Fill in your values there. The build fails until the required values are set.
#pragma once

// 2.4 GHz network to join.
#define WIFI_SSID           ""
#define WIFI_PASSWORD       ""

// Vessel server reachable from the camera's network (IPv4 address or hostname).
#define VESSEL_HOST         ""
#define VESSEL_HTTP_PORT    6174

// Device registered in Vessel (POST /api/devices) and its token (POST /api/devices/:id/token,
// shown only once).
#define VESSEL_DEVICE_ID    ""
#define VESSEL_DEVICE_TOKEN ""

// Streams are published as "<base>/video" and "<base>/audio". Allowed: A-Z a-z 0-9 _ . / -
#define VESSEL_TOPIC_BASE   "esp32cam/front"
