#pragma once

#include <stdint.h>

enum class ManualPump : uint8_t { None, Hydration, Fire };

constexpr uint32_t MANUAL_PUMP_RUN_MS = 3000;
constexpr uint32_t MANUAL_PUMP_COOLDOWN_MS = 10000;

inline uint32_t manualPumpCooldownRemaining(bool hasStopped,
                                             uint32_t now,
                                             uint32_t lastStoppedAt) {
    if (!hasStopped) return 0;
    const uint32_t elapsed = now - lastStoppedAt;
    return elapsed < MANUAL_PUMP_COOLDOWN_MS
        ? MANUAL_PUMP_COOLDOWN_MS - elapsed : 0;
}

inline bool mayStartManualPump(bool outputsEnabled, ManualPump active,
                               bool automaticOutputActive, bool locked,
                               uint32_t cooldownRemaining) {
    return outputsEnabled && active == ManualPump::None &&
           !automaticOutputActive && !locked && cooldownRemaining == 0;
}

inline bool manualPumpRunExpired(ManualPump active, uint32_t now,
                                 uint32_t startedAt) {
    return active != ManualPump::None && now - startedAt >= MANUAL_PUMP_RUN_MS;
}

inline uint32_t manualPumpRunRemaining(ManualPump active, uint32_t now,
                                       uint32_t startedAt) {
    if (active == ManualPump::None) return 0;
    const uint32_t elapsed = now - startedAt;
    return elapsed < MANUAL_PUMP_RUN_MS ? MANUAL_PUMP_RUN_MS - elapsed : 0;
}
