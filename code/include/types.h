#pragma once

#include <Arduino.h>

enum class FireDirection : uint8_t
{
    None,
    Left,
    Center,
    Right
};

struct SensorReadings
{
    float temperatureC = NAN;
    float humidityPercent = NAN;
    int lightRaw = 0;
    int soilRaw = 0;
    int flameLeftRaw = 4095;
    int flameCenterRaw = 4095;
    int flameRightRaw = 4095;
    bool motionDetected = false;
};

const char *fireDirectionName(FireDirection direction);
