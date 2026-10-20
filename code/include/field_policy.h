#pragma once

#include <stdint.h>

// Pure, hardware-independent decisions shared by the proven bench sketch and
// the modular controller. Tests exercise sensor state -> actuator intent.
constexpr uint32_t FIRE_BURST_MS = 10000;
constexpr uint32_t FIRE_REST_MS = 3000;
constexpr uint32_t FIRE_CLEAR_MS = 500;
constexpr uint32_t FIRE_REARM_IDLE_MS = 10000;
constexpr uint8_t FIRE_MAX_BURSTS = 3;
constexpr uint32_t WATER_BURST_MS = 15000;
constexpr uint32_t WATER_SOAK_MS = 30000;
constexpr uint8_t WATER_MAX_BURSTS = 2;

struct IrrigationDecisionInput {
  bool controllerReady;
  bool fireRawLow;
  bool fireConfirmed;
  bool fireLockout;
  bool pumpIdle;
  bool soilValid;
  bool soilDry;
  bool needsWetReset;
  bool dryConfirmed;
  bool cooldownComplete;
  bool waterFault;
};

inline bool mayStartIrrigation(const IrrigationDecisionInput &input) {
  return input.controllerReady && !input.fireRawLow &&
         !input.fireConfirmed && input.pumpIdle &&
         input.soilValid && input.soilDry && !input.needsWetReset &&
         input.dryConfirmed && input.cooldownComplete && !input.waterFault;
}

enum class IrrigationStop : uint8_t { None, Wet, SoilInvalid, BurstElapsed };

inline IrrigationStop irrigationStopDecision(bool running, bool soilValid,
                                             bool soilDry, uint32_t elapsedMs) {
  if (!running) return IrrigationStop::None;
  if (!soilValid) return IrrigationStop::SoilInvalid;
  if (!soilDry) return IrrigationStop::Wet;
  if (elapsedMs >= WATER_BURST_MS) return IrrigationStop::BurstElapsed;
  return IrrigationStop::None;
}

enum class FireStop : uint8_t { None, Cleared, BurstElapsed };

inline FireStop fireStopDecision(bool running, bool fireRawLow,
                                 uint32_t elapsedMs, uint32_t clearMs) {
  if (!running) return FireStop::None;
  if (!fireRawLow && clearMs >= FIRE_CLEAR_MS) return FireStop::Cleared;
  if (elapsedMs >= FIRE_BURST_MS) return FireStop::BurstElapsed;
  return FireStop::None;
}

enum class FireRetry : uint8_t { Idle, Wait, Start, Exhausted };

inline FireRetry fireRetryDecision(bool fireConfirmed, uint8_t completedBursts,
                                  uint32_t restElapsedMs) {
  if (!fireConfirmed) return FireRetry::Idle;
  if (completedBursts >= FIRE_MAX_BURSTS) return FireRetry::Exhausted;
  if (completedBursts == 0 || restElapsedMs >= FIRE_REST_MS)
    return FireRetry::Start;
  return FireRetry::Wait;
}
