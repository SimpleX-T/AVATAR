#pragma once

#include "manual_pump_policy.h"

// Call while holding the system-state lock. The main loop owns the timer;
// networking can request a test without blocking either controller task.
namespace manualPumpTest {
bool start(ManualPump pump, unsigned long now);
void stop(unsigned long now);
void update(unsigned long now);
}
