// Decides which camera frames to send so the average rate matches a cap, whatever the sensor rate.
// Header-only and free of ESP-IDF includes so the host tests can use it.
#pragma once

#include <cstdint>

class FramePacer {
public:
    explicit FramePacer(int64_t interval_us) : interval_us_(interval_us) {}

    // Advancing the deadline by whole intervals (rather than "now + interval") keeps the average at
    // the cap: with a 27 fps sensor, "now + 66.7 ms" always lands between two 37 ms frames and
    // halves the rate to 13.5 fps. After a stall the deadline restarts from now, so no burst of
    // back-to-back frames follows.
    bool should_send(int64_t now_us) {
        if (now_us < next_due_us_) {
            return false;
        }
        const bool stalled = now_us - next_due_us_ > interval_us_;
        next_due_us_ = (stalled ? now_us : next_due_us_) + interval_us_;
        return true;
    }

private:
    int64_t interval_us_;
    int64_t next_due_us_ = 0;
};
