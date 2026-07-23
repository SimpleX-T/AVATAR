#include "timer.h"

bool elapsedSince(unsigned long now, unsigned long startedAt, unsigned long duration)
{
    return static_cast<unsigned long>(now - startedAt) >= duration;
}
