#pragma once

namespace fireControl
{
void begin();
void update(unsigned long now);
void emergencyStop();
void resetSafetyLockout();
}
