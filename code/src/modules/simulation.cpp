#include <Arduino.h>
#include <math.h>

#include "simulation.h"
#include "state.h"
#include "timer.h"

namespace
{
unsigned long startedAt = 0;
unsigned long motionUntil = 0;
bool forceDrySoil = false;
}

namespace simulation
{
void begin()
{
    startedAt = millis();
    systemState.sensors.temperatureC = 28.0F;
    systemState.sensors.humidityPercent = 68.0F;
    systemState.sensors.soilRaw = 1400;
    systemState.sensors.lightRaw = 2600;
}

void update(unsigned long now)
{
    const float seconds = static_cast<float>(now - startedAt) / 1000.0F;

    systemState.sensors.temperatureC = 29.0F + sinf(seconds / 18.0F) * 1.7F;
    systemState.sensors.humidityPercent = 67.0F - sinf(seconds / 22.0F) * 5.0F;
    systemState.sensors.lightRaw = 2500 + static_cast<int>(sinf(seconds / 15.0F) * 450.0F);
    systemState.sensors.soilRaw =
        forceDrySoil ? 2450 : 1450 + static_cast<int>(fmodf(seconds * 3.0F, 500.0F));

    systemState.sensors.motionDetected = now < motionUntil;
    systemState.sensors.flameLeftRaw = 3900;
    systemState.sensors.flameCenterRaw = 3920;
    systemState.sensors.flameRightRaw = 3880;
    systemState.fireDirection = FireDirection::None;
    systemState.fireActive = false;
    systemState.fireSafetyLockout = false;
}

void triggerMotion(unsigned long now)
{
    motionUntil = now + 10000;
}

void makeSoilDry()
{
    forceDrySoil = true;
}

void clearOverrides()
{
    motionUntil = 0;
    forceDrySoil = false;
    systemState.irrigationActive = false;
    systemState.chemigationActive = false;
    systemState.deterrentActive = false;
}
}
