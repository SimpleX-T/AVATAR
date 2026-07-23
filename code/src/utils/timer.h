#pragma once

#include <Arduino.h>

// Rollover-safe elapsed-time check for Arduino's 32-bit millis() clock.
bool elapsedSince(unsigned long now, unsigned long startedAt, unsigned long duration);
