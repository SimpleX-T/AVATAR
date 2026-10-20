#pragma once

namespace irrigation
{
void begin();
void preemptByFire(unsigned long now);
void update(unsigned long now);
void emergencyStop();
void resetSafetyLockout();
}
