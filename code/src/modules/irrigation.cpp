#include <Arduino.h>

#include "config.h"
#include "irrigation.h"
#include "pins.h"
#include "pump.h"
#include "state.h"
#include "timer.h"

namespace
{
unsigned long lastSoilReadAt = 0;
unsigned long drySince = 0;
unsigned long irrigationStartedAt = 0;
unsigned long lastIrrigationEndedAt = 0;
unsigned long chemigationStartedAt = 0;
bool dryTimerRunning = false;
bool hasCompletedIrrigation = false;

void stopIrrigation(unsigned long now)
{
    pump::irrigationOff();
    systemState.irrigationActive = false;
    lastIrrigationEndedAt = now;
    hasCompletedIrrigation = true;
    dryTimerRunning = false;
    Serial.println("[IRRIGATION] Cycle complete.");
}
}

namespace irrigation
{
void begin()
{
    pinMode(SOIL_SENSOR_PIN, INPUT);
}

void update(unsigned long now)
{
    if (systemState.chemigationActive &&
        elapsedSince(now, chemigationStartedAt, CHEMIGATION_DOSE_TIME))
    {
        pump::chemigationOff();
        systemState.chemigationActive = false;
        Serial.println("[CHEMIGATION] Timed dose complete.");
    }

    if (systemState.fireActive || systemState.fireSafetyLockout)
    {
        if (systemState.irrigationActive || systemState.chemigationActive)
            emergencyStop();
        return;
    }

    if (systemState.irrigationActive &&
        elapsedSince(now, irrigationStartedAt, IRRIGATION_RUN_TIME))
    {
        stopIrrigation(now);
    }

    if (!elapsedSince(now, lastSoilReadAt, SOIL_READ_INTERVAL))
        return;
    lastSoilReadAt = now;
    systemState.sensors.soilRaw = analogRead(SOIL_SENSOR_PIN);

    if (systemState.irrigationActive || systemState.chemigationActive)
        return;

    const bool soilIsDry = systemState.sensors.soilRaw >= SOIL_DRY_THRESHOLD;
    if (!soilIsDry)
    {
        dryTimerRunning = false;
        return;
    }

    if (!dryTimerRunning)
    {
        dryTimerRunning = true;
        drySince = now;
        return;
    }

    const bool cooldownComplete =
        !hasCompletedIrrigation ||
        elapsedSince(now, lastIrrigationEndedAt, IRRIGATION_COOLDOWN);

    if (cooldownComplete && elapsedSince(now, drySince, SOIL_DRY_CONFIRM_TIME))
    {
        pump::irrigationOn();
        systemState.irrigationActive = true;
        irrigationStartedAt = now;
        Serial.println("[IRRIGATION] Dry soil confirmed; watering started.");
    }
}

bool startChemigation(unsigned long now)
{
    if (systemState.fireActive || systemState.fireSafetyLockout ||
        systemState.irrigationActive || systemState.chemigationActive)
        return false;

    pump::chemigationOn();
    systemState.chemigationActive = true;
    chemigationStartedAt = now;
    Serial.println("[CHEMIGATION] Manual timed dose started.");
    return true;
}

void emergencyStop()
{
    pump::irrigationOff();
    pump::chemigationOff();
    systemState.irrigationActive = false;
    systemState.chemigationActive = false;
    dryTimerRunning = false;
}
}
