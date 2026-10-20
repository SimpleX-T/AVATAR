#include <Arduino.h>

#include "config.h"
#include "irrigation.h"
#include "pins.h"
#include "pump.h"
#include "state.h"
#include "timer.h"

namespace {
unsigned long lastSoilReadAt = 0;
unsigned long drySince = 0;
unsigned long irrigationStartedAt = 0;
unsigned long lastIrrigationEndedAt = 0;
bool hasRun = false;
bool needsWetReset = false;
bool emergencyLocked = false;

void stop(unsigned long now, const char *event) {
    pump::irrigationOff();
    systemState.irrigationActive = false;
    lastIrrigationEndedAt = now;
    hasRun = true;
    systemState.lastEvent = event;
}
}

namespace irrigation {
void begin() {
    systemState.sensors.soilSensorEnabled = ENABLE_SOIL_MOISTURE_INPUT;
    if (ENABLE_SOIL_MOISTURE_INPUT) pinMode(SOIL_SENSOR_PIN, INPUT);
}

void preemptByFire(unsigned long now) {
    if (!systemState.irrigationActive) return;
    stop(now, "WATER_STOP_FIRE_PRIORITY");
    if (systemState.irrigationBursts > 0) --systemState.irrigationBursts;
    systemState.irrigationSoaking = false;
}

void update(unsigned long now) {
    if (!ENABLE_SOIL_MOISTURE_INPUT) return;
    if (elapsedSince(now, lastSoilReadAt, SOIL_READ_INTERVAL)) {
        lastSoilReadAt = now;
        uint32_t sum = 0;
        for (uint8_t index = 0; index < 16; ++index)
            sum += analogRead(SOIL_SENSOR_PIN);
        const int raw = static_cast<int>(sum / 16);
        systemState.sensors.soilRaw = raw;
        systemState.sensors.soilValid = raw > 0 && raw < 4095;
        if (!systemState.sensors.soilValid) {
            systemState.sensors.soilDry = false;
            drySince = 0;
            if (systemState.irrigationActive) {
                stop(now, "WATER_FAULT_SOIL_INVALID");
                systemState.irrigationSafetyLockout = true;
                needsWetReset = true;
            }
        } else {
            if (!systemState.sensors.soilDry && raw >= SOIL_DRY_THRESHOLD)
                systemState.sensors.soilDry = true;
            else if (systemState.sensors.soilDry && raw <= SOIL_WET_THRESHOLD)
                systemState.sensors.soilDry = false;
            if (!systemState.sensors.soilDry) {
                drySince = 0;
                needsWetReset = false;
                systemState.irrigationBursts = 0;
                systemState.irrigationSoaking = false;
                if (!emergencyLocked && systemState.irrigationSafetyLockout) {
                    systemState.irrigationSafetyLockout = false;
                    systemState.lastEvent = "WATER_RECOVERED_WET_SOIL";
                }
            } else if (drySince == 0) drySince = now;
        }
    }

    if (systemState.irrigationActive) {
        if (systemState.sensors.fireRawLow || systemState.sensors.fireDetected)
            return preemptByFire(now);
        if (!systemState.sensors.soilValid) return;
        if (!systemState.sensors.soilDry) {
            stop(now, "WATER_STOP_WET");
            systemState.irrigationBursts = 0;
            return;
        }
        if (irrigationStopDecision(true, true, true,
                                   now - irrigationStartedAt) !=
            IrrigationStop::BurstElapsed) return;
        stop(now, "WATER_SOAK_AFTER_15S");
        if (systemState.irrigationBursts >= IRRIGATION_MAX_BURSTS) {
            systemState.irrigationSafetyLockout = true;
            needsWetReset = true;
            systemState.lastEvent = "WATER_FAULT_DRY_AFTER_2_BURSTS";
        } else systemState.irrigationSoaking = true;
        return;
    }

    const unsigned long wait = systemState.irrigationBursts > 0
        ? IRRIGATION_SOAK_TIME : IRRIGATION_COOLDOWN;
    const IrrigationDecisionInput decision = {
        systemState.controllerReady && !emergencyLocked,
        systemState.sensors.fireRawLow,
        systemState.sensors.fireDetected,
        systemState.fireSafetyLockout,
        !systemState.fireActive,
        systemState.sensors.soilValid,
        systemState.sensors.soilDry,
        needsWetReset,
        drySince != 0 && elapsedSince(now, drySince, SOIL_DRY_CONFIRM_TIME),
        !hasRun || elapsedSince(now, lastIrrigationEndedAt, wait),
        systemState.irrigationSafetyLockout,
    };
    if (!mayStartIrrigation(decision)) return;
    if (!pump::irrigationOn()) {
        systemState.irrigationSafetyLockout = true;
        systemState.lastEvent = "WATER_OUTPUT_UNAVAILABLE";
        return;
    }
    systemState.irrigationActive = true;
    systemState.irrigationSoaking = false;
    ++systemState.irrigationBursts;
    irrigationStartedAt = now;
    systemState.lastEvent = "WATER_START";
}

void emergencyStop() {
    emergencyLocked = true;
    pump::irrigationOff();
    systemState.irrigationActive = false;
    systemState.irrigationSafetyLockout = true;
    systemState.lastEvent = "EMERGENCY_STOP";
}

void resetSafetyLockout() {
    if (systemState.irrigationActive || systemState.sensors.fireRawLow) return;
    emergencyLocked = false;
    systemState.irrigationSafetyLockout = false;
    needsWetReset = false;
    systemState.irrigationBursts = 0;
    systemState.lastEvent = "WATER_RESET_AFTER_INSPECTION";
}
}
