#include "../standalone_policy.h"

#include <cassert>
#include <cstdio>

int main() {
  const IrrigationDecisionInput afterFireCycle = {
    true,  // controller ready
    false, // fire input returned HIGH
    false, // no confirmed fire now
    true,  // earlier fire cycle locked out its own channel
    true,  // no pump active
    true,  // soil ADC valid
    true,  // dry soil
    false, // no wet-reset requirement
    true,  // dry for long enough
    true,  // cooldown complete
    false  // no latched irrigation fault
  };
  if (!mayStartIrrigation(afterFireCycle)) {
    std::fputs("FAIL: past fire lockout must not suppress irrigation\n", stderr);
    return 1;
  }
  IrrigationDecisionInput activeFire = afterFireCycle;
  activeFire.fireRawLow = true;
  assert(!mayStartIrrigation(activeFire));
  activeFire.fireRawLow = false;
  activeFire.fireConfirmed = true;
  assert(!mayStartIrrigation(activeFire));
  activeFire.fireConfirmed = false;
  activeFire.needsWetReset = true;
  assert(!mayStartIrrigation(activeFire));
  activeFire.needsWetReset = false;
  activeFire.cooldownComplete = false;
  assert(!mayStartIrrigation(activeFire));
  activeFire.cooldownComplete = true;
  activeFire.waterFault = true;
  assert(!mayStartIrrigation(activeFire));

  assert(irrigationStopDecision(true, true, true, 4999) ==
         IrrigationStop::None);
  assert(irrigationStopDecision(true, true, true, 5000) ==
         IrrigationStop::None);
  assert(irrigationStopDecision(true, true, true, 14999) ==
         IrrigationStop::None);
  assert(irrigationStopDecision(true, true, true, 15000) ==
         IrrigationStop::BurstElapsed);
  assert(irrigationStopDecision(true, true, false, 1000) ==
         IrrigationStop::Wet);
  assert(irrigationStopDecision(true, false, true, 1000) ==
         IrrigationStop::SoilInvalid);
  assert(irrigationStopDecision(true, true, false, 15000) ==
         IrrigationStop::Wet);
  assert(irrigationStopDecision(false, true, true, 5000) ==
         IrrigationStop::None);
  assert(fireStopDecision(true, true, 9999, 0) == FireStop::None);
  assert(fireStopDecision(true, true, 10000, 0) == FireStop::BurstElapsed);
  assert(fireStopDecision(true, false, 1000, 499) == FireStop::None);
  assert(fireStopDecision(true, false, 1000, 500) == FireStop::Cleared);
  assert(fireRetryDecision(true, 1, 2999) == FireRetry::Wait);
  assert(fireRetryDecision(true, 1, 3000) == FireRetry::Start);
  assert(fireRetryDecision(true, 3, 3000) == FireRetry::Exhausted);
  assert(fireRetryDecision(false, 1, 3000) == FireRetry::Idle);
  std::puts("PASS: independent bounded fire/water retries and sensor stops");
}
