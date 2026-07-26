#pragma once

namespace irrigation
{
void begin();
void update(unsigned long now);
bool startChemigation(unsigned long now);
void emergencyStop();
}
