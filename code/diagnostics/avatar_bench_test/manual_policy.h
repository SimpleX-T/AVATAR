#pragma once

#include <stdint.h>

// Public controller boundary: a requested local action plus current safety
// state produces an acceptance decision. The sketch alone applies GPIO writes.
enum class ManualAction : uint8_t {
  None,
  PauseAuto,
  ResumeAuto,
  TestWater,
  TestFire,
  TestServo,
  WaterNow,
  FireNow,
  StopAll,
  ResetAfterInspection,
};

enum class ManualReject : uint8_t {
  None,
  InvalidAction,
  NotReady,
  FireInput,
  OutputBusy,
  PauseAutoFirst,
  EmergencyStopped,
  WaterFault,
  FireLockout,
  SoilInvalid,
  SoilNotDry,
  WetReset,
  WaterCooldown,
  ManualCooldown,
};

struct ManualInput {
  bool controllerReady;
  bool fireInput;
  bool outputIdle;
  bool autoPaused;
  bool emergencyStopped;
  bool waterFault;
  bool fireLockout;
  bool soilValid;
  bool soilDry;
  bool manualCooldownComplete;
  bool needsWetReset;
  bool waterCooldownComplete;
};

inline ManualReject manualDecision(ManualAction action,
                                   const ManualInput &input) {
  if (action == ManualAction::StopAll) return ManualReject::None;
  if (action == ManualAction::None) return ManualReject::InvalidAction;
  if (!input.controllerReady) return ManualReject::NotReady;
  if (action == ManualAction::PauseAuto) return ManualReject::None;
  if (action == ManualAction::ResetAfterInspection) {
    if (input.fireInput) return ManualReject::FireInput;
    return input.outputIdle ? ManualReject::None : ManualReject::OutputBusy;
  }
  if (input.emergencyStopped) return ManualReject::EmergencyStopped;
  if (action == ManualAction::ResumeAuto) {
    if (input.fireInput) return ManualReject::FireInput;
    if (!input.outputIdle) return ManualReject::OutputBusy;
    return input.waterFault ? ManualReject::WaterFault : ManualReject::None;
  }
  if (!input.autoPaused) return ManualReject::PauseAutoFirst;
  if (input.fireInput) return ManualReject::FireInput;
  if (!input.outputIdle) return ManualReject::OutputBusy;
  if (!input.manualCooldownComplete) return ManualReject::ManualCooldown;
  if (action == ManualAction::TestServo) return ManualReject::None;
  if (action == ManualAction::TestFire || action == ManualAction::FireNow)
    return input.fireLockout ? ManualReject::FireLockout : ManualReject::None;
  if (input.waterFault) return ManualReject::WaterFault;
  if (action == ManualAction::TestWater) return ManualReject::None;
  if (!input.soilValid) return ManualReject::SoilInvalid;
  if (!input.soilDry) return ManualReject::SoilNotDry;
  if (input.needsWetReset) return ManualReject::WetReset;
  if (!input.waterCooldownComplete) return ManualReject::WaterCooldown;
  return action == ManualAction::WaterNow ? ManualReject::None
                                          : ManualReject::InvalidAction;
}
