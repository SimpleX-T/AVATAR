#include <cassert>
#include <cstdint>

#include "fire_policy.h"

int main()
{
    FirePolicy policy(300, 10000, 2000);

    auto result = policy.update(true, true, 1000);
    assert(!result.responseActive);
    assert(!result.startResponse);

    result = policy.update(false, true, 1100);
    assert(!result.responseActive);

    result = policy.update(true, true, 2000);
    assert(!result.responseActive);

    result = policy.update(true, true, 2300);
    assert(result.responseActive);
    assert(result.startResponse);

    result = policy.update(true, true, 12300);
    assert(!result.responseActive);
    assert(result.stopResponse);
    assert(result.lockout);

    result = policy.update(true, true, 12400, true);
    assert(result.lockout);

    result = policy.update(false, true, 12500, true);
    assert(!result.lockout);
    assert(!result.responseActive);

    FirePolicy unavailablePump(300, 10000, 2000);
    unavailablePump.update(true, true, 1000, false, false);
    result = unavailablePump.update(true, true, 1300, false, false);
    assert(!result.responseActive);
    assert(!result.startResponse);
    assert(result.actionUnavailable);
    assert(result.lockout);

    FirePolicy manualStop(300, 10000, 2000);
    manualStop.update(true, true, 1000);
    manualStop.update(true, true, 1300);
    result = manualStop.emergencyStop();
    assert(result.stopResponse);
    assert(!result.responseActive);
    assert(result.lockout);
}
