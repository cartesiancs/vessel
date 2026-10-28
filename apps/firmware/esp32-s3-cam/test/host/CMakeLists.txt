# Host-side tests for the platform-independent firmware modules.
#   cmake -S test/host -B test/host/build && cmake --build test/host/build
#   ./test/host/build/test_rtp_jpeg [frame.jpg ...]
cmake_minimum_required(VERSION 3.16)
project(vessel_cam_host_tests CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(FIRMWARE_MAIN ${CMAKE_CURRENT_LIST_DIR}/../../main)

add_compile_options(-Wall -Wextra -Werror -fsanitize=address,undefined)
add_link_options(-fsanitize=address,undefined)

add_executable(test_rtp_jpeg test_rtp_jpeg.cpp ${FIRMWARE_MAIN}/rtp_jpeg.cpp)
target_include_directories(test_rtp_jpeg PRIVATE ${FIRMWARE_MAIN})

add_executable(udp_send_jpeg udp_send_jpeg.cpp ${FIRMWARE_MAIN}/rtp_jpeg.cpp)
target_include_directories(udp_send_jpeg PRIVATE ${FIRMWARE_MAIN})

add_executable(test_frame_pacer test_frame_pacer.cpp)
target_include_directories(test_frame_pacer PRIVATE ${FIRMWARE_MAIN})
