#include <Arduino.h>

#include "config.h"
#include "fire.h"
#include "pins.h"
#include "pump.h"
#include "servo.h"
#include "state.h"
#include "timer.h"

namespace
{
unsigned long lastScanAt = 0;
unsigned long responseStartedAt = 0;
unsigned long lastFlameSeenAt = 0;

FireDirection detectDirection()
{
    const int left = systemState.sensors.flameLeftRaw;
    const int center = systemState.sensors.flameCenterRaw;
    const int right = systemState.sensors.flameRightRaw;
    const int strongest = min(left, min(center, right));

    if (strongest >= FLAME_DETECTED_THRESHOLD)
        return FireDirection::None;
    if (strongest == left)
        return FireDirection::Left;
    if (strongest == right)
        return FireDirection::Right;
    return FireDirection::Center;
}

void stopResponse()
{
    pump::fireOff();
    pump::valveOff();
    fireServo::center();
    systemState.fireActive = false;
    systemState.fireDirection = FireDirection::None;
}
}

namespace fireControl
{
void begin()
{
    pinMode(FLAME_LEFT_PIN, INPUT);
    pinMode(FLAME_CENTER_PIN, INPUT);
    pinMode(FLAME_RIGHT_PIN, INPUT);
}

void update(unsigned long now)
{
    if (!elapsedSince(now, lastScanAt, FIRE_SCAN_INTERVAL))
        return;
    lastScanAt = now;

    systemState.sensors.flameLeftRaw = analogRead(FLAME_LEFT_PIN);
    systemState.sensors.flameCenterRaw = analogRead(FLAME_CENTER_PIN);
    systemState.sensors.flameRightRaw = analogRead(FLAME_RIGHT_PIN);

    const FireDirection direction = detectDirection();
    if (direction != FireDirection::None)
    {
        lastFlameSeenAt = now;
        systemState.fireDirection = direction;

        if (!systemState.fireActive && !systemState.fireSafetyLockout)
        {
            systemState.fireActive = true;
            responseStartedAt = now;
            // Fire response has priority over fluid-delivery operations.
            pump::irrigationOff();
            pump::chemigationOff();
            systemState.irrigationActive = false;
            systemState.chemigationActive = false;
            pump::valveOn();
            pump::fireOn();
        }

        if (systemState.fireActive)
            fireServo::pointTo(direction);
    }

    if (systemState.fireActive &&
        elapsedSince(now, responseStartedAt, FIRE_MAX_RESPONSE_TIME))
    {
        stopResponse();
        systemState.fireSafetyLockout = true;
        Serial.println("[SAFETY] Fire response timed out. Inspect system, then send 'r'.");
        return;
    }

    if (systemState.fireActive &&
        direction == FireDirection::None &&
        elapsedSince(now, lastFlameSeenAt, FIRE_CLEAR_HOLD_TIME))
    {
        stopResponse();
        Serial.println("[FIRE] Flame clear; suppression stopped.");
    }
}

void resetSafetyLockout()
{
    if (systemState.fireActive)
        return;
    systemState.fireSafetyLockout = false;
    Serial.println("[SAFETY] Fire-response lockout cleared.");
}
}
