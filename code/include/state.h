#pragma once

#include "types.h"
#include "manual_pump_policy.h"

struct SystemState
{
    SensorReadings sensors;
    bool fireActive = false;
    bool fireSafetyLockout = false;
    bool irrigationActive = false;
    bool irrigationSafetyLockout = false;
    bool controllerReady = false;
    ManualPump manualPump = ManualPump::None;
    unsigned long manualPumpStartedAt = 0;
    unsigned long manualPumpLastStoppedAt = 0;
    bool manualPumpHasStopped = false;
    uint8_t fireBursts = 0;
    uint8_t irrigationBursts = 0;
    bool fireResting = false;
    bool irrigationSoaking = false;
    const char *lastEvent = "BOOT";
};

extern SystemState systemState;

bool initializeSystemStateLock();
void lockSystemState();
void unlockSystemState();
