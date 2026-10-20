#include <Arduino.h>

#include "state.h"

void printSystemStatus()
{
    Serial.println();
    Serial.println("------ FARM SYSTEM STATUS ------");
    Serial.printf("Climate: %.1f C, %.1f %% RH, MQ6=%d ADC / DO=%d\n",
                  systemState.sensors.temperatureC,
                  systemState.sensors.humidityPercent,
                  systemState.sensors.mq6Raw,
                  systemState.sensors.mq6Digital);
    Serial.printf("Soil raw: %d (%s, dry=%s) | irrigation=%s | fault=%s\n",
                  systemState.sensors.soilRaw,
                  systemState.sensors.soilValid ? "valid" : "invalid",
                  systemState.sensors.soilDry ? "YES" : "NO",
                  systemState.irrigationActive ? "ON" : "OFF",
                  systemState.irrigationSafetyLockout ? "YES" : "NO");
    Serial.printf("Fire sensor=%s | detected=%s | fire pump=%s | lockout=%s\n",
                  systemState.sensors.fireSensorEnabled ? "enabled" : "disabled",
                  systemState.sensors.fireDetected ? "YES" : "NO",
                  systemState.fireActive ? "ON" : "OFF",
                  systemState.fireSafetyLockout ? "YES" : "NO");
    Serial.printf("Probe raw pH=%u EC=%u N=%u P=%u K=%u | last=%s\n",
                  systemState.sensors.probeRaw[0], systemState.sensors.probeRaw[1],
                  systemState.sensors.probeRaw[2], systemState.sensors.probeRaw[3],
                  systemState.sensors.probeRaw[4], systemState.lastEvent);
    Serial.println("--------------------------------");
}
