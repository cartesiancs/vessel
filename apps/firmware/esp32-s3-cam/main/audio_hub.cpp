#include "audio_hub.hpp"

#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstring>
#include <mutex>

#include "esp_heap_caps.h"

namespace {

constexpr uint32_t kRingBlocks = 64;    // ~1.3 s; a power of two so indices survive cursor wrap
constexpr uint32_t kMaxLagBlocks = 15;  // 300 ms
constexpr uint32_t kPrimeBlocks = 3;
static_assert((kRingBlocks & (kRingBlocks - 1)) == 0);
static_assert(kMaxLagBlocks < kRingBlocks);

std::mutex g_mutex;
std::condition_variable g_cv;
int16_t* g_ring;
uint32_t g_head;  // total number of blocks pushed

int16_t* block_at(uint32_t index) { return g_ring + (index % kRingBlocks) * audio_hub::kBlockSamples; }

}  // namespace

esp_err_t audio_hub::init() {
    g_ring = static_cast<int16_t*>(heap_caps_calloc(kRingBlocks * kBlockSamples, sizeof(int16_t), MALLOC_CAP_SPIRAM));
    return g_ring != nullptr ? ESP_OK : ESP_ERR_NO_MEM;
}

void audio_hub::push(const int16_t* block) {
    {
        std::lock_guard lock(g_mutex);
        memcpy(block_at(g_head), block, kBlockBytes);
        g_head++;
    }
    g_cv.notify_all();
}

uint32_t audio_hub::start_cursor() {
    std::lock_guard lock(g_mutex);
    return g_head > kPrimeBlocks ? g_head - kPrimeBlocks : 0;
}

size_t audio_hub::read(uint32_t& cursor, int16_t* dst, size_t max_blocks, uint32_t timeout_ms) {
    std::unique_lock lock(g_mutex);
    if (!g_cv.wait_for(lock, std::chrono::milliseconds(timeout_ms), [&] { return g_head != cursor; })) {
        return 0;
    }
    if (g_head - cursor > kMaxLagBlocks) {
        cursor = g_head - kPrimeBlocks;
    }
    const size_t count = std::min<size_t>(g_head - cursor, max_blocks);
    for (size_t i = 0; i < count; i++) {
        memcpy(dst + i * kBlockSamples, block_at(cursor + i), kBlockBytes);
    }
    cursor += count;
    return count;
}
