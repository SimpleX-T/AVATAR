#include <Arduino.h>
#include <math.h>

#include "simulation.h"
#include "state.h"
#include "timer.h"

namespace
{
unsigned long startedAt = 0;
bool forceDrySoil = false;
}

namespace simulation
{
void begin()
{
    startedAt = millis();
    systemState.sensors.temperatureC = 28.0F;
    systemState.sensors.humidityPercent = 68.0F;
    systemState.sensors.soilRaw = 1800;
    systemState.sensors.soilValid = true;
}

void update(unsigned long now)
{
    const float seconds = static_cast<float>(now - startedAt) / 1000.0F;

    systemState.sensors.temperatureC = 29.0F + sinf(seconds / 18.0F) * 1.7F;
    systemState.sensors.humidityPercent = 67.0F - sinf(seconds / 22.0F) * 5.0F;
    systemState.sensors.soilRaw =
        forceDrySoil ? 3200 : 1800 + static_cast<int>(fmodf(seconds * 3.0F, 250.0F));
    systemState.sensors.soilDry = forceDrySoil;
    systemState.sensors.soilValid = true;

    systemState.sensors.fireDetected = false;
    systemState.sensors.fireSensorEnabled = true;
    systemState.sensors.fireSensorReady = true;
    systemState.sensors.soilSensorEnabled = true;
    systemState.fireActive = false;
    systemState.fireSafetyLockout = false;
    systemState.controllerReady = true;
}

void makeSoilDry()
{
    forceDrySoil = true;
}

void clearOverrides()
{
    forceDrySoil = false;
    systemState.irrigationActive = false;
}
}
