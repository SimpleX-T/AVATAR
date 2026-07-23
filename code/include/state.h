#pragma once

#include "types.h"

struct SystemState
{
    SensorReadings sensors;
    FireDirection fireDirection = FireDirection::None;
    bool fireActive = false;
    bool fireSafetyLockout = false;
    bool irrigationActive = false;
    bool chemigationActive = false;
    bool deterrentActive = false;
};

extern SystemState systemState;
