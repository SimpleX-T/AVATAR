#include <Arduino.h>

#include "state.h"

void printSystemStatus()
{
    Serial.println();
    Serial.println("------ FARM SYSTEM STATUS ------");
    Serial.printf("Climate: %.1f C, %.1f %% RH, light=%d\n",
                  systemState.sensors.temperatureC,
                  systemState.sensors.humidityPercent,
                  systemState.sensors.lightRaw);
    Serial.printf("Soil: %d | irrigation=%s | chemigation=%s\n",
                  systemState.sensors.soilRaw,
                  systemState.irrigationActive ? "ON" : "OFF",
                  systemState.chemigationActive ? "ON" : "OFF");
    Serial.printf("Flame L/C/R: %d/%d/%d | direction=%s | response=%s\n",
                  systemState.sensors.flameLeftRaw,
                  systemState.sensors.flameCenterRaw,
                  systemState.sensors.flameRightRaw,
                  fireDirectionName(systemState.fireDirection),
                  systemState.fireActive ? "ON" : "OFF");
    Serial.printf("Motion=%s | deterrent=%s | fire lockout=%s\n",
                  systemState.sensors.motionDetected ? "YES" : "NO",
                  systemState.deterrentActive ? "ON" : "OFF",
                  systemState.fireSafetyLockout ? "YES" : "NO");
    Serial.println("--------------------------------");
}
