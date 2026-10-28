# secrets.h is gitignored. Seed it from the template so it always exists; the build then fails
# on the static_asserts in config.cpp until the values are filled in.
if(NOT EXISTS "${CMAKE_CURRENT_LIST_DIR}/secrets.h")
    configure_file("${CMAKE_CURRENT_LIST_DIR}/secrets.example.h" "${CMAKE_CURRENT_LIST_DIR}/secrets.h" COPYONLY)
    message(WARNING "Created main/secrets.h from secrets.example.h: fill in the Wi-Fi and Vessel values")
endif()

idf_component_register(
    SRCS "main.cpp"
         "config.cpp"
         "wifi_manager.cpp"
         "camera_service.cpp"
         "mic_service.cpp"
         "audio_hub.cpp"
         "rtp_packet.cpp"
         "rtp_jpeg.cpp"
         "opus_encoder.cpp"
         "vessel_client.cpp"
         "link_supervisor.cpp"
         "video_tx.cpp"
         "audio_tx.cpp"
    INCLUDE_DIRS "."
    PRIV_REQUIRES esp_wifi esp_netif esp_event nvs_flash esp_http_client esp_driver_i2s esp_timer esp_psram
                  json lwip
)

target_compile_options(${COMPONENT_LIB} PRIVATE -Wall -Wextra -Werror)
