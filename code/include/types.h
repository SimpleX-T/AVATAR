#pragma once

#include <Arduino.h>

struct SensorReadings
{
    float temperatureC = NAN;
    float humidityPercent = NAN;
    int soilRaw = -1;
    bool soilValid = false;
    bool soilDry = false;
    bool soilSensorEnabled = false;
    bool fireDetected = false;
    bool fireRawLow = false;
    bool fireSensorReady = false;
    bool fireSensorEnabled = false;
    int mq6Raw = -1;
    int mq6Digital = -1;
    uint16_t probeRaw[5] = {};
    bool probeValid[5] = {};
    unsigned long probeLastGoodAt[5] = {};
};
