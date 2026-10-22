#include <Arduino.h>

#include "config.h"
#include "fire.h"
#include "irrigation.h"
#include "manual_pump_test.h"
#include "pins.h"
#include "pump.h"
#include "servo.h"
#include "state.h"
#include "timer.h"

namespace {
unsigned long lastScanAt = 0;
unsigned long lowSince = 0;
unsigned long clearSince = 0;
unsigned long idleSince = 0;
unsigned long responseStartedAt = 0;
unsigned long restStartedAt = 0;
bool emergencyLocked = false;

void stopResponse(const char *event) {
    pump::fireOff();
    fireServo::center();
    systemState.fireActive = false;
    systemState.lastEvent = event;
}

void resetBursts() {
    systemState.fireBursts = 0;
    systemState.fireResting = false;
    restStartedAt = 0;
}
}

namespace fireControl {
void begin() {
    systemState.sensors.fireSensorEnabled = ENABLE_FIRE_SENSOR_INPUT;
    if (ENABLE_FIRE_SENSOR_INPUT) pinMode(FIRE_SENSOR_PIN, INPUT);
}

void update(unsigned long now) {
    if (!ENABLE_FIRE_SENSOR_INPUT ||
        !elapsedSince(now, lastScanAt, FIRE_SCAN_INTERVAL)) return;
    lastScanAt = now;
    const bool rawLow = digitalRead(FIRE_SENSOR_PIN) == FIRE_SENSOR_ACTIVE_LEVEL;
    systemState.sensors.fireRawLow = rawLow;

    if (!rawLow) {
        lowSince = 0;
        systemState.sensors.fireDetected = false;
        if (clearSince == 0) clearSince = now;
        if (idleSince == 0) idleSince = now;
        if (elapsedSince(now, idleSince, FIRE_IDLE_STARTUP_TIME))
            systemState.sensors.fireSensorReady = true;
        if (fireStopDecision(systemState.fireActive, rawLow,
                             now - responseStartedAt, now - clearSince) ==
            FireStop::Cleared) {
            stopResponse("FIRE_STOP_CONFIRMED_CLEAR");
            resetBursts();
        }
        if (systemState.fireSafetyLockout && !emergencyLocked &&
            elapsedSince(now, idleSince, FIRE_REARM_IDLE_TIME)) {
            systemState.fireSafetyLockout = false;
            resetBursts();
            systemState.lastEvent = "FIRE_REARMED_AFTER_CLEAR";
        }
        return;
    }

    clearSince = 0;
    idleSince = 0;
    if (!systemState.sensors.fireSensorReady) return;
    if (lowSince == 0) lowSince = now;
    systemState.sensors.fireDetected =
        elapsedSince(now, lowSince, FIRE_CONFIRM_TIME);
    if (!systemState.sensors.fireDetected || emergencyLocked) return;

    if (systemState.fireActive) {
        fireServo::sweep(now);
        if (fireStopDecision(true, rawLow, now - responseStartedAt, 0) ==
            FireStop::BurstElapsed) {
            stopResponse("FIRE_BURST_ENDED");
            if (systemState.fireBursts >= FIRE_MAX_BURSTS) {
                systemState.fireSafetyLockout = true;
                systemState.lastEvent = "FIRE_FAULT_PERSISTENT_AFTER_3_BURSTS";
            } else {
                restStartedAt = now;
                systemState.fireResting = true;
                systemState.lastEvent = "FIRE_REST_AFTER_10S";
            }
        }
        return;
    }

    const FireRetry retry = fireRetryDecision(
        true, systemState.fireBursts,
        systemState.fireResting ? now - restStartedAt : 0);
    if (systemState.fireSafetyLockout || retry != FireRetry::Start) return;
    irrigation::preemptByFire(now);
    // Fire priority outranks a manual pump test; release the outputs first.
    manualPumpTest::stop(now);
    if (!pump::fireOn()) {
        systemState.fireSafetyLockout = true;
        systemState.lastEvent = "FIRE_OUTPUT_UNAVAILABLE";
        return;
    }
    fireServo::start();
    systemState.fireActive = true;
    systemState.fireResting = false;
    ++systemState.fireBursts;
    responseStartedAt = now;
    systemState.lastEvent = "FIRE_START";
}

void resetSafetyLockout() {
    if (systemState.fireActive || systemState.sensors.fireRawLow) return;
    emergencyLocked = false;
    systemState.fireSafetyLockout = false;
    resetBursts();
    systemState.lastEvent = "FIRE_RESET_AFTER_INSPECTION";
}

void emergencyStop() {
    emergencyLocked = true;
    stopResponse("EMERGENCY_STOP");
    systemState.fireSafetyLockout = true;
}
}
