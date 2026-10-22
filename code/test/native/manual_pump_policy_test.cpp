#include <cassert>
#include <cstdint>
#include <limits>

#include "manual_pump_policy.h"

int main() {
    assert(mayStartManualPump(true, ManualPump::None, false, false, 0));
    assert(!mayStartManualPump(false, ManualPump::None, false, false, 0));
    assert(!mayStartManualPump(true, ManualPump::Fire, false, false, 0));
    assert(!mayStartManualPump(true, ManualPump::None, true, false, 0));
    assert(!mayStartManualPump(true, ManualPump::None, false, true, 0));
    assert(!mayStartManualPump(true, ManualPump::None, false, false, 1));
    assert(!manualPumpRunExpired(ManualPump::Fire, 2999, 0));
    assert(manualPumpRunExpired(ManualPump::Fire, 3000, 0));
    assert(manualPumpCooldownRemaining(true, 12000, 3000) == 1000);
    assert(manualPumpCooldownRemaining(true, 13000, 3000) == 0);
    const uint32_t startedNearWrap = std::numeric_limits<uint32_t>::max() - 1000;
    assert(!manualPumpRunExpired(ManualPump::Hydration, 1998, startedNearWrap));
    assert(manualPumpRunExpired(ManualPump::Hydration, 1999, startedNearWrap));
}
