// Unit tests for FramePacer: simulated sensor clocks against a 15 fps cap.

#include <cstdint>
#include <cstdio>

#include "frame_pacer.hpp"

namespace {

int g_failures = 0;

#define CHECK(cond)                                                    \
    do {                                                               \
        if (!(cond)) {                                                 \
            std::printf("FAIL %s:%d: %s\n", __FILE__, __LINE__, #cond); \
            g_failures++;                                              \
        }                                                              \
    } while (0)

constexpr int64_t kUsPerSecond = 1'000'000;
constexpr int64_t kCapFps = 15;
constexpr int64_t kIntervalUs = kUsPerSecond / kCapFps;
constexpr int kSimulatedSeconds = 60;

// Sends frames arriving every `period_us` for kSimulatedSeconds; returns how many were sent.
int sent_frames(int64_t period_us) {
    FramePacer pacer(kIntervalUs);
    int sent = 0;
    for (int64_t t = 0; t < kSimulatedSeconds * kUsPerSecond; t += period_us) {
        if (pacer.should_send(t)) {
            sent++;
        }
    }
    return sent;
}

bool near(int value, int expected, int tolerance) { return value >= expected - tolerance && value <= expected + tolerance; }

void test_fast_sensor_reaches_cap() {
    // The OV3660 measured 27 fps on the board (37 ms frames); the old pacing sent 13.5 fps.
    constexpr int64_t kSensor27FpsUs = kUsPerSecond / 27;
    CHECK(near(sent_frames(kSensor27FpsUs), kCapFps * kSimulatedSeconds, 1));
    constexpr int64_t kSensor30FpsUs = kUsPerSecond / 30;
    CHECK(near(sent_frames(kSensor30FpsUs), kCapFps * kSimulatedSeconds, 1));
    constexpr int64_t kSensor20FpsUs = kUsPerSecond / 20;
    CHECK(near(sent_frames(kSensor20FpsUs), kCapFps * kSimulatedSeconds, 1));
}

void test_slow_sensor_sends_every_frame() {
    constexpr int64_t kSensor10FpsUs = kUsPerSecond / 10;
    CHECK(sent_frames(kSensor10FpsUs) == 10 * kSimulatedSeconds);
}

void test_no_burst_after_stall() {
    FramePacer pacer(kIntervalUs);
    CHECK(pacer.should_send(0));
    // A 2 s gap (e.g. camera grab timeout) must not let the next frames through back to back.
    constexpr int64_t kStallEndUs = 2 * kUsPerSecond;
    constexpr int64_t kSensorPeriodUs = kUsPerSecond / 30;
    CHECK(pacer.should_send(kStallEndUs));
    CHECK(!pacer.should_send(kStallEndUs + kSensorPeriodUs));
    CHECK(pacer.should_send(kStallEndUs + 2 * kSensorPeriodUs + 1));
}

void test_never_two_frames_closer_than_one_sensor_period() {
    FramePacer pacer(kIntervalUs);
    constexpr int64_t kSensorPeriodUs = kUsPerSecond / 27;
    int64_t last_sent = -kUsPerSecond;
    int64_t min_gap = kUsPerSecond;
    for (int64_t t = 0; t < 10 * kUsPerSecond; t += kSensorPeriodUs) {
        if (pacer.should_send(t)) {
            if (t - last_sent < min_gap) {
                min_gap = t - last_sent;
            }
            last_sent = t;
        }
    }
    CHECK(min_gap >= kSensorPeriodUs);
}

}  // namespace

int main() {
    test_fast_sensor_reaches_cap();
    test_slow_sensor_sends_every_frame();
    test_no_burst_after_stall();
    test_never_two_frames_closer_than_one_sensor_period();
    if (g_failures != 0) {
        std::printf("%d check(s) failed\n", g_failures);
        return 1;
    }
    std::printf("all frame_pacer tests passed\n");
    return 0;
}
