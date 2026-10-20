#include "../manual_policy.h"

#include <cassert>
#include <cstdio>

int main() {
  ManualInput ready = {
      true,  // controller ready
      false, // fire input idle
      true,  // outputs idle
      true,  // automatic irrigation paused
      false, // emergency stop clear
      false, // irrigation fault clear
      false, // fire lockout clear
      true,  // soil sensor valid
      true,  // soil dry
      true,  // manual test cooldown complete
      false, // no wet reset pending
      true,  // water cooldown complete
  };

  assert(manualDecision(ManualAction::TestWater, ready) == ManualReject::None);
  assert(manualDecision(ManualAction::WaterNow, ready) == ManualReject::None);
  assert(manualDecision(ManualAction::TestFire, ready) == ManualReject::None);
  assert(manualDecision(ManualAction::TestServo, ready) == ManualReject::None);

  ready.autoPaused = false;
  assert(manualDecision(ManualAction::TestWater, ready) == ManualReject::PauseAutoFirst);
  ready.autoPaused = true;
  ready.fireInput = true;
  assert(manualDecision(ManualAction::TestFire, ready) == ManualReject::FireInput);
  assert(manualDecision(ManualAction::StopAll, ready) == ManualReject::None);
  ready.fireInput = false;
  ready.waterFault = true;
  assert(manualDecision(ManualAction::WaterNow, ready) == ManualReject::WaterFault);
  ready.waterFault = false;
  ready.soilDry = false;
  assert(manualDecision(ManualAction::WaterNow, ready) == ManualReject::SoilNotDry);
  ready.soilDry = true;
  ready.fireLockout = true;
  assert(manualDecision(ManualAction::FireNow, ready) == ManualReject::FireLockout);
  ready.fireLockout = false;
  ready.emergencyStopped = true;
  assert(manualDecision(ManualAction::TestServo, ready) == ManualReject::EmergencyStopped);
  assert(manualDecision(ManualAction::ResumeAuto, ready) == ManualReject::EmergencyStopped);
  assert(manualDecision(ManualAction::ResetAfterInspection, ready) == ManualReject::None);
  std::puts("PASS: manual controls respect fire, moisture and stop locks");
}
