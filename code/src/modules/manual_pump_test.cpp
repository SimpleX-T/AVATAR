#include <Arduino.h>

#include "config.h"
#include "manual_pump_test.h"
#include "pump.h"
#include "state.h"

namespace manualPumpTest {
bool start(ManualPump requested, unsigned long now) {
    if (requested == ManualPump::None ||
        !mayStartManualPump(
            ENABLE_MANUAL_PUMP_TESTS && ENABLE_PUMP_OUTPUTS,
            systemState.manualPump,
            systemState.fireActive || systemState.irrigationActive,
            systemState.fireSafetyLockout || systemState.irrigationSafetyLockout,
            manualPumpCooldownRemaining(systemState.manualPumpHasStopped,
                                        now, systemState.manualPumpLastStoppedAt)))
        return false;

    pump::allOff();
    const bool started = requested == ManualPump::Fire
        ? pump::fireOn() : pump::irrigationOn();
    if (!started) return false;

    systemState.manualPump = requested;
    systemState.manualPumpStartedAt = now;
    systemState.lastEvent = requested == ManualPump::Fire
        ? "TEST_FIRE_PUMP_START" : "TEST_HYDRATION_PUMP_START";
    return true;
}

void stop(unsigned long now) {
    pump::allOff();
    if (systemState.manualPump == ManualPump::None) return;
    systemState.manualPump = ManualPump::None;
    systemState.manualPumpLastStoppedAt = now;
    systemState.manualPumpHasStopped = true;
    systemState.lastEvent = "PUMP_TEST_STOPPED";
}

void update(unsigned long now) {
    if (!manualPumpRunExpired(systemState.manualPump, now,
                              systemState.manualPumpStartedAt)) return;
    stop(now);
    systemState.lastEvent = "PUMP_TEST_TIME_LIMIT";
}
}
