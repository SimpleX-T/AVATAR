#include <Arduino.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <WebServer.h>
#include <WiFi.h>
#include <atomic>

#include "standalone_policy.h"
#include "manual_policy.h"
#include "wifi_secrets.h"
#include "../soil-probe/include/rtu_frame.h"

// Standalone, LAN-only integrated bench firmware. No internet account or
// ThingSpeak channel is required. Do not expose its HTTP control port online.
// These moisture limits came from this sensor's accepted wet/dry capture.
// Recalibrate before using a different probe, supply, or soil installation.
namespace {
constexpr uint8_t SOIL_AO_PIN = 35;
constexpr uint8_t FIRE_DO_PIN = 34;
constexpr uint8_t DHT_PIN = 13;
constexpr uint8_t MQ6_AO_PIN = 39;
constexpr uint8_t MQ6_DO_PIN = 36;
constexpr uint8_t FIRE_IN1_PIN = 25;
constexpr uint8_t FIRE_IN2_PIN = 26;
constexpr uint8_t WATER_IN3_PIN = 32;
constexpr uint8_t WATER_IN4_PIN = 33;
constexpr uint8_t SERVO_PIN = 14;
constexpr uint8_t STATUS_LED_PIN = 22; // External LED + series resistor.
constexpr uint8_t PROBE_RX_PIN = 16;   // MAX485 RO via 3.3 V level divider.
constexpr uint8_t PROBE_TX_PIN = 17;   // MAX485 DI.
constexpr uint8_t PROBE_DIR_PIN = 4;   // Tied MAX485 DE and /RE.
constexpr uint8_t PROBE_ADDRESS = 2;
constexpr uint32_t PROBE_POLL_INTERVAL_MS = 60000;
constexpr uint32_t PROBE_STALE_MS = 180000;
constexpr uint32_t PROBE_REPLY_TIMEOUT_MS = 1200;
constexpr uint32_t PROBE_INTERBYTE_MS = 80;
constexpr uint8_t PROBE_REGISTER_COUNT = 5;
constexpr uint8_t PROBE_REGISTERS[PROBE_REGISTER_COUNT] = {7, 2, 4, 5, 6};

constexpr uint16_t DRY_ON_ADC = 2928;
constexpr uint16_t WET_OFF_ADC = 2408;
constexpr uint32_t STARTUP_MS = 10000;
constexpr uint32_t FIRE_IDLE_MS = 1000;
constexpr uint32_t FIRE_CONFIRM_MS = 300;
constexpr uint32_t DRY_CONFIRM_MS = 3000;
constexpr uint32_t WATER_COOLDOWN_MS = 60000;
constexpr uint32_t FIRE_SAMPLE_MS = 50;
constexpr uint32_t SOIL_SAMPLE_MS = 500;
constexpr uint32_t DHT_SAMPLE_MS = 3000;
constexpr uint32_t MQ6_SAMPLE_MS = 2000;
constexpr uint32_t SERVO_STEP_MS = 35;
constexpr int SERVO_MIN_DEG = 45;
constexpr int SERVO_MAX_DEG = 135;
constexpr float HOT_DEMO_C = 35.0f;
constexpr float DRY_AIR_DEMO_RH = 55.0f;
constexpr uint32_t MANUAL_TEST_MS = 2000;
constexpr uint32_t SERVO_TEST_MS = 3000;
constexpr uint32_t MANUAL_COOLDOWN_MS = 1000;

static_assert(DRY_ON_ADC > WET_OFF_ADC, "Moisture hysteresis is reversed");
static_assert(SERVO_MIN_DEG >= 0 && SERVO_MAX_DEG <= 180 &&
                  SERVO_MIN_DEG < SERVO_MAX_DEG, "Invalid servo travel");

enum class Pump : uint8_t { None, Irrigation, Fire };
enum class StopReason : uint8_t {
  Wet, SoilInvalid, WaterBurst, FirePriority, AutoPaused,
  FireCleared, FireBurst, ManualTestDone, Emergency
};
enum class LedPhase : uint8_t { StartSymbol, EndSymbol, LetterGap };
struct ProbeReading {
  uint16_t raw;
  uint32_t lastGoodAt;
  bool hasValue;
  uint8_t lastStatus;
};
struct StatusSnapshot {
  bool ready;
  bool fireLockout;
  bool waterFault;
  bool soilValid;
  bool soilDry;
  bool fireRawLow;
  bool fireConfirmed;
  bool dhtValid;
  uint16_t soilRaw;
  uint16_t mq6Raw;
  int mq6Digital;
  float temperatureC;
  float humidityPercent;
  Pump activePump;
  bool servoAttached;
  bool servoAttempted;
  bool lastServoAttachOk;
  bool autoPaused;
  bool emergencyStopped;
  bool manualTestRunning;
  bool servoTestRunning;
  uint8_t fireBursts;
  uint8_t waterBursts;
  bool fireResting;
  bool waterSoaking;
  const char *fireState;
  const char *waterState;
  const char *lastEvent;
  uint32_t lastEventAt;
  char ledLetter;
  ProbeReading probe[PROBE_REGISTER_COUNT];
};

DHT dht(DHT_PIN, DHT11);
Servo fireServo;
WebServer web(80);
std::atomic_bool networkReady{false};
bool ledFireOverride = false;
portMUX_TYPE statusMux = portMUX_INITIALIZER_UNLOCKED;
StatusSnapshot publishedStatus = {};

Pump activePump = Pump::None;
uint32_t pumpStartedAt = 0;
uint32_t lastWaterStoppedAt = 0;
bool waterHasRun = false;
bool irrigationNeedsWet = false;
bool fireLockout = false;
bool waterFault = false;
const char *lastEvent = "BOOT";
uint32_t lastEventAt = 0;
bool servoAttempted = false;
bool lastServoAttachOk = false;
bool autoPaused = false;
bool emergencyStopped = false;
bool manualTestPump = false;
bool manualFireOverride = false;
uint8_t fireBursts = 0;
uint8_t waterBursts = 0;
uint32_t fireRestStartedAt = 0;
uint32_t fireClearSince = 0;
uint32_t servoTestStartedAt = 0;
uint32_t manualLastStoppedAt = 0;
ManualAction pendingAction = ManualAction::None;

uint32_t lastFireSampleAt = 0;
uint32_t lastSoilSampleAt = 0;
uint32_t lastDhtSampleAt = 0;
uint32_t lastMq6SampleAt = 0;
uint32_t fireIdleSince = 0;
uint32_t fireLowSince = 0;
uint32_t drySince = 0;
uint32_t lastServoStepAt = 0;
bool fireRawLow = false;
bool fireReady = false;
bool fireConfirmed = false;
bool soilValid = false;
bool soilDry = false;
bool dhtValid = false;
uint16_t soilRaw = 0;
uint16_t mq6Raw = 0;
int mq6Digital = -1;
float temperatureC = NAN;
float humidityPercent = NAN;
int servoAngle = SERVO_MIN_DEG;
int servoDirection = 1;
ProbeReading probeReadings[PROBE_REGISTER_COUNT] = {};

LedPhase ledPhase = LedPhase::StartSymbol;
const char *ledPattern = ".";
char ledLetter = 'E';
uint8_t ledSymbolIndex = 0;
uint8_t ledRoundRobin = 0;
uint32_t ledNextAt = 0;

bool due(uint32_t now, uint32_t &last, uint32_t interval) {
  if (now - last < interval) return false;
  last = now;
  return true;
}

soilProbeRtu::Result readProbeRegister(uint8_t address) {
  uint8_t request[8] = {PROBE_ADDRESS, 3, 0, address, 0, 1, 0, 0};
  const uint16_t crc = soilProbeRtu::crc16(request, 6);
  request[6] = static_cast<uint8_t>(crc);
  request[7] = static_cast<uint8_t>(crc >> 8);
  while (Serial2.available()) Serial2.read();
  digitalWrite(PROBE_DIR_PIN, HIGH);
  delayMicroseconds(200);
  Serial2.write(request, sizeof(request));
  Serial2.flush(true); // Wait for final stop bit; keep receiver bytes intact.
  digitalWrite(PROBE_DIR_PIN, LOW);

  uint8_t reply[16] = {};
  size_t count = 0;
  bool overflow = false;
  bool gotByte = false;
  const uint32_t started = millis();
  uint32_t lastByte = started;
  while (millis() - started < PROBE_REPLY_TIMEOUT_MS) {
    while (Serial2.available()) {
      const uint8_t byte = static_cast<uint8_t>(Serial2.read());
      if (count < sizeof(reply)) reply[count++] = byte;
      else overflow = true;
      gotByte = true;
      lastByte = millis();
    }
    if (gotByte && millis() - lastByte >= PROBE_INTERBYTE_MS) break;
    vTaskDelay(pdMS_TO_TICKS(1));
  }
  if (overflow)
    return {soilProbeRtu::Status::UnexpectedLength, 0, 0};
  return soilProbeRtu::decodeSingleRegister(reply, count, PROBE_ADDRESS, 3);
}

void probeTask(void *) {
  pinMode(PROBE_DIR_PIN, OUTPUT);
  digitalWrite(PROBE_DIR_PIN, LOW); // Receiver enabled while idle.
  Serial2.begin(9600, SERIAL_8N1, PROBE_RX_PIN, PROBE_TX_PIN);
  vTaskDelay(pdMS_TO_TICKS(3000));
  for (;;) {
    for (uint8_t index = 0; index < PROBE_REGISTER_COUNT; ++index) {
      const auto result = readProbeRegister(PROBE_REGISTERS[index]);
      portENTER_CRITICAL(&statusMux);
      ProbeReading &reading = probeReadings[index];
      reading.lastStatus = static_cast<uint8_t>(result.status);
      if (result.status == soilProbeRtu::Status::Valid) {
        reading.raw = result.value;
        reading.lastGoodAt = millis();
        reading.hasValue = true;
      }
      portEXIT_CRITICAL(&statusMux);
      vTaskDelay(pdMS_TO_TICKS(100));
    }
    vTaskDelay(pdMS_TO_TICKS(PROBE_POLL_INTERVAL_MS));
  }
}

bool controllerReady(uint32_t now) {
  return now >= STARTUP_MS && fireReady;
}

void outputLow(uint8_t pin) {
  digitalWrite(pin, LOW);
  pinMode(pin, OUTPUT);
}

void pumpsOff() {
  digitalWrite(FIRE_IN1_PIN, LOW);
  digitalWrite(FIRE_IN2_PIN, LOW);
  digitalWrite(WATER_IN3_PIN, LOW);
  digitalWrite(WATER_IN4_PIN, LOW);
}

void recordEvent(const char *event, uint32_t now) {
  lastEvent = event;
  lastEventAt = now;
}

void stopPump(uint32_t now, StopReason reason) {
  if (activePump == Pump::None) return;
  const Pump stopped = activePump;
  pumpsOff();
  if (fireServo.attached()) fireServo.detach();
  activePump = Pump::None;
  if (manualTestPump) {
    manualTestPump = false;
    manualLastStoppedAt = now;
    recordEvent(reason == StopReason::Emergency ? "EMERGENCY_STOP" :
                reason == StopReason::FirePriority ?
                "WATER_TEST_STOP_FIRE_PRIORITY" : "MANUAL_TEST_DONE", now);
  } else if (stopped == Pump::Irrigation) {
    waterHasRun = true;
    lastWaterStoppedAt = now;
    if (reason == StopReason::Wet) {
      waterBursts = 0;
      waterFault = false;
      irrigationNeedsWet = false;
      recordEvent("WATER_STOP_WET", now);
    } else if (reason == StopReason::SoilInvalid) {
      waterFault = true;
      irrigationNeedsWet = true;
      recordEvent("WATER_FAULT_SOIL_INVALID", now);
    } else if (reason == StopReason::WaterBurst) {
      if (waterBursts >= WATER_MAX_BURSTS) {
        waterFault = true;
        irrigationNeedsWet = true;
        recordEvent("WATER_FAULT_DRY_AFTER_2_BURSTS", now);
      } else {
        recordEvent("WATER_SOAK_AFTER_15S", now);
      }
    } else {
      // An interrupted burst did not get a full chance to wet the soil.
      if (waterBursts > 0) --waterBursts;
      recordEvent(reason == StopReason::FirePriority ?
                  "WATER_STOP_FIRE_PRIORITY" :
                  reason == StopReason::AutoPaused ? "WATER_STOP_PAUSED" :
                  "EMERGENCY_STOP", now);
    }
  } else {
    if (reason == StopReason::FireCleared) {
      fireBursts = 0;
      fireRestStartedAt = 0;
      fireLockout = false;
      recordEvent("FIRE_STOP_CONFIRMED_CLEAR", now);
    } else if (reason == StopReason::FireBurst) {
      if (manualFireOverride) {
        recordEvent("MANUAL_FIRE_DONE_10S", now);
      } else if (fireBursts >= FIRE_MAX_BURSTS) {
        fireLockout = true;
        recordEvent("FIRE_FAULT_PERSISTENT_AFTER_3_BURSTS", now);
      } else {
        fireRestStartedAt = now;
        recordEvent("FIRE_REST_AFTER_10S", now);
      }
    } else {
      fireBursts = 0;
      fireRestStartedAt = 0;
      recordEvent("EMERGENCY_STOP", now);
    }
  }
  manualFireOverride = false;
}

void enforceIrrigationStop(uint32_t now) {
  if (manualTestPump && activePump == Pump::Irrigation) return;
  const IrrigationStop decision = irrigationStopDecision(
      activePump == Pump::Irrigation, soilValid, soilDry,
      now - pumpStartedAt);
  switch (decision) {
    case IrrigationStop::Wet:
      stopPump(now, StopReason::Wet);
      break;
    case IrrigationStop::SoilInvalid:
      stopPump(now, StopReason::SoilInvalid);
      break;
    case IrrigationStop::BurstElapsed:
      if (fireRawLow || fireConfirmed) break; // Give fire preemption priority.
      stopPump(now, StopReason::WaterBurst);
      break;
    case IrrigationStop::None:
      break;
  }
}

void startPump(Pump requested, uint32_t now) {
  if (activePump != Pump::None) return;
  pumpsOff();
  if (requested == Pump::Fire) {
    if (!manualTestPump && !manualFireOverride) ++fireBursts;
    fireServo.setPeriodHertz(50);
    fireServo.attach(SERVO_PIN, 1000, 2000);
    servoAttempted = true;
    lastServoAttachOk = fireServo.attached();
    if (lastServoAttachOk) {
      servoAngle = SERVO_MIN_DEG;
      servoDirection = 1;
      fireServo.write(servoAngle);
      lastServoStepAt = now;
    }
    digitalWrite(FIRE_IN1_PIN, HIGH);
    recordEvent(lastServoAttachOk ? "FIRE_START" :
                "FIRE_START_SERVO_ATTACH_FAILED", now);
  } else {
    if (!manualTestPump) ++waterBursts;
    digitalWrite(WATER_IN3_PIN, HIGH);
    recordEvent("WATER_START", now);
  }
  activePump = requested;
  pumpStartedAt = now;
}

ManualInput currentManualInput(uint32_t now) {
  return {controllerReady(now), fireRawLow || fireConfirmed,
          activePump == Pump::None && servoTestStartedAt == 0,
          autoPaused, emergencyStopped, waterFault, fireLockout,
          soilValid, soilDry,
          manualLastStoppedAt == 0 || now - manualLastStoppedAt >= MANUAL_COOLDOWN_MS,
          irrigationNeedsWet,
          !waterHasRun || now - lastWaterStoppedAt >=
              (waterBursts > 0 ? WATER_SOAK_MS : WATER_COOLDOWN_MS)};
}

void applyManualAction(ManualAction action, uint32_t now) {
  if (action == ManualAction::StopAll) {
    emergencyStopped = true;
    autoPaused = true;
    if (activePump != Pump::None) stopPump(now, StopReason::Emergency);
    if (fireServo.attached()) fireServo.detach();
    servoTestStartedAt = 0;
    pumpsOff();
    recordEvent("EMERGENCY_STOP", now);
    return;
  }
  if (manualDecision(action, currentManualInput(now)) != ManualReject::None) {
    recordEvent("COMMAND_REJECTED_SAFETY_STATE", now);
    return;
  }
  switch (action) {
    case ManualAction::PauseAuto:
      autoPaused = true;
      if (activePump == Pump::Irrigation)
        stopPump(now, StopReason::AutoPaused);
      recordEvent("AUTO_PAUSED", now);
      break;
    case ManualAction::ResumeAuto:
      autoPaused = false;
      recordEvent("AUTO_RESUMED", now);
      break;
    case ManualAction::TestWater:
      manualTestPump = true;
      startPump(Pump::Irrigation, now);
      recordEvent("TEST_WATER_START", now);
      break;
    case ManualAction::TestFire:
      manualTestPump = true;
      manualFireOverride = true;
      startPump(Pump::Fire, now);
      recordEvent("TEST_FIRE_START", now);
      break;
    case ManualAction::TestServo:
      fireServo.setPeriodHertz(50);
      fireServo.attach(SERVO_PIN, 1000, 2000);
      servoAttempted = true;
      lastServoAttachOk = fireServo.attached();
      if (lastServoAttachOk) {
        servoTestStartedAt = now;
        servoAngle = SERVO_MIN_DEG;
        servoDirection = 1;
        lastServoStepAt = now;
        fireServo.write(servoAngle);
      }
      recordEvent(lastServoAttachOk ? "TEST_SERVO_START" :
                  "TEST_SERVO_ATTACH_FAILED", now);
      break;
    case ManualAction::WaterNow:
      startPump(Pump::Irrigation, now);
      break;
    case ManualAction::FireNow:
      manualFireOverride = true;
      startPump(Pump::Fire, now);
      break;
    case ManualAction::ResetAfterInspection:
      emergencyStopped = false;
      fireLockout = false;
      waterFault = false;
      fireBursts = 0;
      fireRestStartedAt = 0;
      waterBursts = 0;
      irrigationNeedsWet = false;
      waterHasRun = false;
      // A human inspection explicitly authorizes a new bounded attempt.
      autoPaused = true;
      recordEvent("FAULT_RESET_AFTER_INSPECTION", now);
      break;
    default: break;
  }
}

void consumeManualAction(uint32_t now) {
  ManualAction action;
  portENTER_CRITICAL(&statusMux);
  action = pendingAction;
  pendingAction = ManualAction::None;
  portEXIT_CRITICAL(&statusMux);
  if (action != ManualAction::None) applyManualAction(action, now);
}

void sampleFire(uint32_t now) {
  if (!due(now, lastFireSampleAt, FIRE_SAMPLE_MS)) return;
  fireRawLow = digitalRead(FIRE_DO_PIN) == LOW;
  if (!fireRawLow) {
    fireLowSince = 0;
    fireConfirmed = false;
    if (fireClearSince == 0) fireClearSince = now;
    if (fireIdleSince == 0) fireIdleSince = now;
    if (now - fireIdleSince >= FIRE_IDLE_MS) fireReady = true;
    if (fireLockout && now - fireIdleSince >= FIRE_REARM_IDLE_MS) {
      fireLockout = false;
      fireBursts = 0;
      fireRestStartedAt = 0;
      recordEvent("FIRE_REARMED_AFTER_CLEAR", now);
    }
    return;
  }
  fireClearSince = 0;
  fireIdleSince = 0;
  if (!fireReady) return; // A stuck-LOW input cannot activate at boot.
  if (fireLowSince == 0) fireLowSince = now;
  fireConfirmed = now - fireLowSince >= FIRE_CONFIRM_MS;
}

void sampleSoil(uint32_t now) {
  if (!due(now, lastSoilSampleAt, SOIL_SAMPLE_MS)) return;
  uint32_t total = 0;
  for (uint8_t i = 0; i < 16; ++i) total += analogRead(SOIL_AO_PIN);
  soilRaw = total / 16;
  soilValid = soilRaw != 0 && soilRaw != 4095;
  if (!soilValid) {
    soilDry = false;
    drySince = 0;
    enforceIrrigationStop(now);
    return;
  }
  if (!soilDry && soilRaw >= DRY_ON_ADC) soilDry = true;
  else if (soilDry && soilRaw <= WET_OFF_ADC) soilDry = false;
  if (!soilDry) {
    drySince = 0;
    irrigationNeedsWet = false;
    waterBursts = 0;
    if (waterFault) {
      waterFault = false;
      recordEvent("WATER_RECOVERED_WET_SOIL", now);
    }
  } else if (drySince == 0) {
    drySince = now;
  }
  enforceIrrigationStop(now);
}

void sampleClimate(uint32_t now) {
  if (!due(now, lastDhtSampleAt, DHT_SAMPLE_MS)) return;
  const float rh = dht.readHumidity();
  const float temp = dht.readTemperature();
  dhtValid = isfinite(rh) && isfinite(temp) && rh >= 0 && rh <= 100;
  temperatureC = dhtValid ? temp : NAN;
  humidityPercent = dhtValid ? rh : NAN;
}

void sampleMq6(uint32_t now) {
  if (due(now, lastMq6SampleAt, MQ6_SAMPLE_MS)) {
    uint32_t total = 0;
    for (uint8_t i = 0; i < 16; ++i) total += analogRead(MQ6_AO_PIN);
    mq6Raw = total / 16;
    mq6Digital = digitalRead(MQ6_DO_PIN);
  }
}

void updateOutputs(uint32_t now) {
  if (emergencyStopped) return;
  if (manualTestPump && activePump != Pump::None &&
      now - pumpStartedAt >= MANUAL_TEST_MS)
    stopPump(now, StopReason::ManualTestDone);
  if (servoTestStartedAt != 0 && now - servoTestStartedAt >= SERVO_TEST_MS) {
    if (fireServo.attached()) fireServo.detach();
    servoTestStartedAt = 0;
    manualLastStoppedAt = now;
    recordEvent("TEST_SERVO_DONE", now);
  }
  if (activePump == Pump::Fire && !manualTestPump) {
    const auto decision = fireStopDecision(
        true, fireRawLow || manualFireOverride, now - pumpStartedAt,
        fireClearSince == 0 ? 0 : now - fireClearSince);
    if (decision == FireStop::Cleared)
      stopPump(now, StopReason::FireCleared);
    else if (decision == FireStop::BurstElapsed)
      stopPump(now, StopReason::FireBurst);
  }
  if (!fireRawLow && !fireLockout && fireBursts > 0 &&
      fireClearSince != 0 && now - fireClearSince >= FIRE_CLEAR_MS &&
      activePump != Pump::Fire) {
    fireBursts = 0;
    fireRestStartedAt = 0;
    recordEvent("FIRE_REARMED_AFTER_CLEAR", now);
  }

  if (fireConfirmed && controllerReady(now)) {
    if (activePump == Pump::Irrigation)
      stopPump(now, StopReason::FirePriority);
    if (servoTestStartedAt != 0) {
      fireServo.detach();
      servoTestStartedAt = 0;
      recordEvent("SERVO_TEST_STOP_FIRE_PRIORITY", now);
    }
    const uint32_t restMs = fireRestStartedAt == 0 ? 0 :
                            now - fireRestStartedAt;
    if (activePump == Pump::None && !fireLockout &&
        fireRetryDecision(fireConfirmed, fireBursts, restMs) ==
            FireRetry::Start)
      startPump(Pump::Fire, now);
  }
  if (activePump == Pump::Irrigation && !manualTestPump)
    enforceIrrigationStop(now);
  if ((activePump == Pump::Fire || servoTestStartedAt != 0) &&
      fireServo.attached() &&
      due(now, lastServoStepAt, SERVO_STEP_MS)) {
    servoAngle += servoDirection * 2;
    if (servoAngle >= SERVO_MAX_DEG) {
      servoAngle = SERVO_MAX_DEG;
      servoDirection = -1;
    } else if (servoAngle <= SERVO_MIN_DEG) {
      servoAngle = SERVO_MIN_DEG;
      servoDirection = 1;
    }
    fireServo.write(servoAngle);
  }

  const IrrigationDecisionInput waterDecision = {
    controllerReady(now), fireRawLow, fireConfirmed, fireLockout,
    activePump == Pump::None, soilValid, soilDry, irrigationNeedsWet,
    drySince != 0 && now - drySince >= DRY_CONFIRM_MS,
    !waterHasRun || now - lastWaterStoppedAt >=
        (waterBursts > 0 ? WATER_SOAK_MS : WATER_COOLDOWN_MS),
    waterFault
  };
  if (autoPaused || !mayStartIrrigation(waterDecision)) return;
  startPump(Pump::Irrigation, now);
}

const char *morsePattern(char letter) {
  switch (letter) {
    case 'B': return "-..."; // Boot / waiting for stable fire input
    case 'E': return ".";    // Healthy heartbeat
    case 'F': return "..-."; // Fire detected or fire cycle locked out
    case 'G': return "--.";  // MQ-6 comparator raw DO=0, not gas ppm
    case 'H': return "...."; // Hot and dry air, data only
    case 'X': return "-..-"; // Input or LAN fault
    default: return ".";
  }
}

char nextLedLetter(uint32_t now) {
  if (!controllerReady(now)) return 'B';
  if (fireConfirmed || fireLockout) return 'F';
  if (!networkReady || !soilValid || !dhtValid || waterFault) return 'X';
  char active[2] = {};
  uint8_t count = 0;
  if (mq6Digital == 0) active[count++] = 'G';
  if (temperatureC >= HOT_DEMO_C &&
      humidityPercent <= DRY_AIR_DEMO_RH) active[count++] = 'H';
  if (count == 0) return 'E';
  return active[ledRoundRobin++ % count];
}

void updateLed(uint32_t now) {
  if (fireConfirmed) {
    digitalWrite(STATUS_LED_PIN, HIGH); // Immediate local warning.
    ledLetter = 'F';
    ledFireOverride = true;
    return;
  }
  if (ledFireOverride) {
    digitalWrite(STATUS_LED_PIN, LOW);
    ledFireOverride = false;
    ledPhase = LedPhase::LetterGap;
    ledNextAt = now;
  }
  if (static_cast<int32_t>(now - ledNextAt) < 0) return;
  if (ledPhase == LedPhase::StartSymbol) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    ledNextAt = now + (ledPattern[ledSymbolIndex] == '-' ? 540 : 180);
    ledPhase = LedPhase::EndSymbol;
  } else if (ledPhase == LedPhase::EndSymbol) {
    digitalWrite(STATUS_LED_PIN, LOW);
    ++ledSymbolIndex;
    ledNextAt = now + (ledPattern[ledSymbolIndex] ? 180 : 1200);
    ledPhase = ledPattern[ledSymbolIndex] ?
                   LedPhase::StartSymbol : LedPhase::LetterGap;
  } else {
    ledLetter = nextLedLetter(now);
    ledPattern = morsePattern(ledLetter);
    ledSymbolIndex = 0;
    ledPhase = LedPhase::StartSymbol;
  }
}

const char *waterState(uint32_t now) {
  if (activePump == Pump::Irrigation) return "RUNNING";
  if (waterFault) return "FAULT_CHECK_WATER_PATH";
  if (emergencyStopped) return "STOPPED_BY_USER";
  if (!controllerReady(now)) return "STARTING";
  if (!soilValid) return "SOIL_INVALID";
  if (!soilDry) return "SOIL_WET";
  if (fireRawLow || fireConfirmed || activePump == Pump::Fire)
    return "FIRE_INPUT";
  if (irrigationNeedsWet) return "WAIT_WET_RESET";
  if (waterBursts > 0 && now - lastWaterStoppedAt < WATER_SOAK_MS)
    return "SOAKING";
  if (autoPaused) return "AUTO_PAUSED";
  if (waterHasRun && waterBursts == 0 &&
      now - lastWaterStoppedAt < WATER_COOLDOWN_MS)
    return "COOLDOWN";
  if (drySince == 0 || now - drySince < DRY_CONFIRM_MS)
    return "CONFIRMING_DRY";
  return "READY";
}

const char *fireState(uint32_t now) {
  if (emergencyStopped) return "STOPPED_BY_USER";
  if (fireLockout) return "FAULT_PERSISTENT_FIRE";
  if (activePump == Pump::Fire) return "SPRAYING";
  if (fireConfirmed && fireBursts > 0 && fireRestStartedAt != 0 &&
      now - fireRestStartedAt < FIRE_REST_MS) return "RESTING_BEFORE_RETRY";
  if (fireRawLow) return "CONFIRMING_FIRE";
  return controllerReady(now) ? "READY" : "STARTING";
}

void publishStatus(uint32_t now) {
  StatusSnapshot next = {
    controllerReady(now), fireLockout, waterFault, soilValid, soilDry, fireRawLow,
    fireConfirmed, dhtValid, soilRaw, mq6Raw, mq6Digital,
    temperatureC, humidityPercent, activePump, fireServo.attached(),
    servoAttempted, lastServoAttachOk, autoPaused, emergencyStopped,
    manualTestPump, servoTestStartedAt != 0, fireBursts, waterBursts,
    activePump == Pump::None && fireConfirmed && fireBursts > 0 &&
        fireRestStartedAt != 0 && now - fireRestStartedAt < FIRE_REST_MS,
    activePump == Pump::None && soilDry && !waterFault && waterBursts > 0 &&
        now - lastWaterStoppedAt < WATER_SOAK_MS,
    fireState(now), waterState(now), lastEvent,
    lastEventAt, ledLetter, {}
  };
  portENTER_CRITICAL(&statusMux);
  for (uint8_t i = 0; i < PROBE_REGISTER_COUNT; ++i)
    next.probe[i] = probeReadings[i];
  publishedStatus = next;
  portEXIT_CRITICAL(&statusMux);
}

const char PAGE[] PROGMEM = R"HTML(
<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AVATAR · field bench</title>
<style>
:root{color-scheme:light;--ink:#183126;--muted:#52675b;--line:#dce6dc;
--bg:#edf2eb;--paper:#fff;--green:#1a6f4d;--amber:#9a5c16;--red:#a3332b}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);
font:16px/1.45 system-ui,-apple-system,sans-serif}
main{max-width:740px;margin:auto;padding:20px 16px 48px}
header{padding:12px 4px 18px}h1{font-size:1.8rem;line-height:1.12;
letter-spacing:-.04em;margin:4px 0 8px}h2{font-size:1.04rem;letter-spacing:-.015em;
margin:0 0 14px}p{margin:0}small,.hint{color:var(--muted);font-size:.85rem;
line-height:1.5}.eyebrow{font-size:.72rem;letter-spacing:.12em;
text-transform:uppercase;font-weight:800;color:var(--green)}
.connection{display:inline-block;margin-top:10px;padding:6px 10px;
border-radius:99px;background:#e0eee4;color:#17583b;font-size:.85rem;font-weight:700}
.connection.offline{background:#fae4df;color:var(--red)}
.alert{display:block;padding:16px 18px;margin-bottom:12px;border-radius:16px;
background:#fff0db;color:#75440e;font-weight:750}
.alert.danger{background:#fae4df;color:var(--red)}
.card{background:var(--paper);border:1px solid var(--line);border-radius:18px;
padding:18px;margin:0 0 12px;box-shadow:0 3px 14px #153b1b08}
.card-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.tag{border-radius:99px;padding:4px 9px;background:#e2eee6;color:var(--green);
font-size:.74rem;font-weight:800;white-space:nowrap}
.tag.warn{background:#fff0db;color:var(--amber)}
.tag.danger{background:#fae4df;color:var(--red)}
.hero{border-color:#bed6c4;background:#f7fbf6}
.hero-value{font-size:1.55rem;line-height:1.2;font-weight:800;letter-spacing:-.035em;
margin:3px 0 6px}.hero .hint{margin-bottom:14px}
dl{margin:0}dl>div{display:flex;justify-content:space-between;align-items:baseline;
gap:12px;border-top:1px solid var(--line);padding:10px 0}
dl>div:last-child{padding-bottom:0}dt{color:var(--muted);font-size:.91rem}
dd{margin:0;text-align:right;font-weight:750;overflow-wrap:anywhere}
.section-label{font-size:.74rem;text-transform:uppercase;letter-spacing:.1em;
color:var(--muted);font-weight:800;margin:20px 4px 10px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.grid .card{margin:0}
.event{font-size:.84rem;overflow-wrap:anywhere}
button{border:0;background:var(--ink);color:white;border-radius:10px;
padding:10px 14px;font:700 .88rem system-ui;cursor:pointer}
button.danger{background:var(--red)}button.secondary{background:#e2eee6;color:var(--ink)}
.controls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
.controls button{min-height:46px}.control-note{margin-top:10px}
input{width:100%;margin-top:8px;padding:12px;border:1px solid var(--line);
border-radius:10px;font:inherit;background:#fff}
button:focus-visible{outline:3px solid #85b89a;outline-offset:2px}
textarea{display:block;width:100%;height:166px;margin-top:12px;padding:12px;
border:1px solid var(--line);border-radius:10px;background:#f7faf6;
color:var(--ink);font:12px/1.4 ui-monospace,monospace;resize:vertical}
footer{padding:16px 4px 0}
@media(max-width:570px){.grid,.controls{grid-template-columns:1fr}
main{padding:16px 12px 40px}}
</style>
<main><header><div class="eyebrow">Off-grid agriculture · diagnostic</div>
<h1>AVATAR field bench</h1><p class="hint">Live readings from this ESP32.
Local Wi-Fi only; no cloud upload.</p><div class="connection" id="connection">Connecting…</div>
</header>
<div id="alerts" role="status" aria-live="polite"></div>
<section class="card hero" aria-label="Actuator status">
<div class="card-head"><h2>Response status</h2><span class="tag" id="ready">—</span></div>
<div class="hero-value" id="pump">—</div>
<p class="hint">Commanded output only · this cannot confirm a motor turned.</p>
<dl><div><dt>Irrigation state</dt><dd id="waterstate">—</dd></div>
<div><dt>Fire response</dt><dd id="firestate">—</dd></div>
<div><dt>Fire attempts this event</dt><dd id="firebursts">—</dd></div>
<div><dt>Water attempts this cycle</dt><dd id="waterbursts">—</dd></div>
<div><dt>Fire fault</dt><dd id="lockout">—</dd></div>
<div><dt>Irrigation fault</dt><dd id="waterfault">—</dd></div>
<div><dt>Servo signal now</dt><dd id="servo">—</dd></div>
<div><dt>Servo attach at last fire start</dt><dd id="servoresult">—</dd></div>
<div><dt>Last output event</dt><dd class="event" id="event">—</dd></div>
</dl></section>
<section class="card" aria-label="Manual controls">
<div class="card-head"><h2>Manual controls</h2><span class="tag" id="mode">AUTO</span></div>
<p class="hint">Pause automatic watering before using a manual control.
Fire detection still takes priority. Outputs have hard software time limits.</p>
<label for="pin" class="hint">Control PIN</label>
<input id="pin" type="password" autocomplete="off" inputmode="text"
placeholder="Enter PIN for this session">
<div class="section-label">1 · Choose mode</div><div class="controls">
<button data-action="pause" type="button" class="secondary">Pause auto watering</button>
<button data-action="resume" type="button" class="secondary">Resume auto watering</button>
</div><div class="section-label">2 · Short equipment tests</div><div class="controls">
<button data-action="test_water" type="button">Test water pump · 2 s</button>
<button data-action="test_fire" type="button">Test fire pump · 2 s</button>
<button data-action="test_servo" type="button">Test servo · 3 s</button>
</div><div class="section-label">3 · Live actions</div><div class="controls">
<button data-action="water_now" type="button">Water dry soil now</button>
<button data-action="fire_now" type="button" class="danger">Run fire response · max 10 s</button>
</div><div class="section-label">Stop and recovery</div><div class="controls">
<button data-action="stop_all" type="button" class="danger">STOP ALL</button>
<button data-action="reset" type="button" class="secondary">Reset after inspection</button>
</div><p class="hint control-note" id="controlmessage" role="status" aria-live="polite">
Buttons command outputs; they cannot confirm a pump turned or water flowed.
Use the physical power cutoff if hardware behaves unexpectedly.</p></section>
<div class="section-label">Sensor readings</div>
<div class="grid">
<section class="card" aria-label="Soil moisture"><div class="card-head">
<h2>Soil moisture</h2><span class="tag" id="soiltag">—</span></div><dl>
<div><dt>Dry soil</dt><dd id="dry">—</dd></div>
<div><dt>Raw reading</dt><dd id="soil">—</dd></div>
</dl><p class="hint">Dry at 2928 or higher; wet reset at 2408 or lower.</p></section>
<section class="card" aria-label="Fire sensor"><div class="card-head">
<h2>Fire sensor</h2><span class="tag" id="firetag">—</span></div><dl>
<div><dt>Detection</dt><dd id="fire">—</dd></div>
<div><dt>Digital input</dt><dd id="firedo">—</dd></div>
</dl><p class="hint">0 means the module sees its fire stimulus.</p></section>
<section class="card" aria-label="Air temperature and humidity">
<div class="card-head"><h2>Air climate</h2><span class="tag">DHT11</span></div><dl>
<div><dt>Temperature</dt><dd id="temp">—</dd></div>
<div><dt>Humidity</dt><dd id="rh">—</dd></div>
</dl></section>
<section class="card" aria-label="MQ-6 gas module">
<div class="card-head"><h2>Air gas module</h2><span class="tag warn">RAW ONLY</span></div><dl>
<div><dt>Analog reading</dt><dd id="mq6ao">—</dd></div>
<div><dt>Comparator input</dt><dd id="mq6do">—</dd></div>
</dl><p class="hint">Uncalibrated. Not gas concentration or a safety alarm.</p>
</section></div>
<section class="card" style="margin-top:12px" aria-label="RS-485 soil probe">
<div class="card-head"><h2>Soil chemistry probe</h2><span class="tag warn" id="probetag">WAITING</span></div>
<dl><div><dt>pH</dt><dd id="ph">—</dd></div>
<div><dt>EC</dt><dd id="ec">—</dd></div>
<div><dt>Nitrogen</dt><dd id="nitrogen">—</dd></div>
<div><dt>Phosphorus</dt><dd id="phosphorus">—</dd></div>
<div><dt>Potassium</dt><dd id="potassium">—</dd></div></dl>
<p class="hint" id="probehealth">Waiting for first read.</p>
<p class="hint">Manual-based units are provisional; no calibration or fertilizer advice.</p>
</section>
<section class="card" style="margin-top:12px" aria-label="Diagnostic log">
<div class="card-head"><h2>Live test log</h2><button id="copy" type="button">Copy log</button></div>
<p class="hint" id="loghint">One line every 2 seconds while this page stays open.
Latest 300 lines kept.</p>
<textarea id="log" readonly aria-label="Copyable diagnostic log"></textarea>
<p class="hint" style="margin-top:10px">LED code now: <strong id="led">—</strong></p>
</section>
<footer class="hint">This is supervised bench firmware. No ThingSpeak upload.
Pump cutoffs are software limits, not a fire-suppression guarantee.</footer>
</main>
<script>
const lines=[];let busy=false;
function put(id,value){document.getElementById(id).textContent=value}
function appendLog(line){
 lines.push(new Date().toLocaleTimeString()+' | '+line);
 if(lines.length>300)lines.shift();
 const box=document.getElementById('log');box.value=lines.join('\n');
 box.scrollTop=box.scrollHeight;
}
const waterLabels={RUNNING:'Spraying now',STARTING:'Controller starting',
 SOIL_INVALID:'Soil reading invalid',SOIL_WET:'Soil is wet',
 FIRE_INPUT:'Fire input has priority',WAIT_WET_RESET:'Waiting for wet reading',
 SOAKING:'Waiting 30 s for water to soak in',
 COOLDOWN:'Cooling down after last spray',CONFIRMING_DRY:'Confirming dryness',
 FAULT_CHECK_WATER_PATH:'Stopped · check water path',
 AUTO_PAUSED:'Automatic watering paused',STOPPED_BY_USER:'Stopped by user',
 READY:'Ready to spray'};
const fireLabels={STARTING:'Starting',READY:'Ready',SPRAYING:'Spraying',
 RESTING_BEFORE_RETRY:'Resting 3 s before another attempt',
 CONFIRMING_FIRE:'Checking fire input',
 FAULT_PERSISTENT_FIRE:'Stopped after 3 attempts · inspect',
 STOPPED_BY_USER:'Stopped by user'};
const eventLabels={BOOT:'No output event yet',FIRE_START:'Fire pump commanded ON',
 FIRE_START_SERVO_ATTACH_FAILED:'Fire pump ON; servo signal attach failed',
 FIRE_STOP_CONFIRMED_CLEAR:'Fire input cleared; pump stopped',
 FIRE_REST_AFTER_10S:'Fire pump resting 3 s before retry',
 FIRE_FAULT_PERSISTENT_AFTER_3_BURSTS:'Fire still detected after 3 attempts; inspect now',
 FIRE_REARMED_AFTER_CLEAR:'Fire response automatically rearmed after clear input',
 MANUAL_FIRE_DONE_10S:'Manual fire response finished after 10 s',
 WATER_START:'Irrigation pump commanded ON',
 WATER_SOAK_AFTER_15S:'Water pump paused to let moisture soak in',
 WATER_FAULT_DRY_AFTER_2_BURSTS:'Watering stopped after 2 attempts; check water path',
 WATER_FAULT_SOIL_INVALID:'Watering stopped: soil reading invalid',
 WATER_RECOVERED_WET_SOIL:'Watering fault cleared by wet soil reading',
 WATER_STOP_WET:'Irrigation stopped: soil wet',
 WATER_STOP_FIRE_PRIORITY:'Irrigation stopped: fire priority',
 PROBE_TASK_FAILED:'Soil chemistry task did not start',
 AUTO_PAUSED:'Automatic watering paused',AUTO_RESUMED:'Automatic watering resumed',
 TEST_WATER_START:'Water pump test started',TEST_FIRE_START:'Fire pump test started',
 TEST_SERVO_START:'Servo test started',TEST_SERVO_DONE:'Servo test finished',
 TEST_SERVO_ATTACH_FAILED:'Servo signal attach failed',
 MANUAL_TEST_DONE:'Timed test finished',EMERGENCY_STOP:'All outputs stopped',
 FAULT_RESET_AFTER_INSPECTION:'Fault reset after inspection',
 COMMAND_REJECTED_SAFETY_STATE:'Command blocked by current safety state',
 WATER_STOP_PAUSED:'Watering stopped: automatic mode paused',
 WATER_TEST_STOP_FIRE_PRIORITY:'Water test stopped: fire priority'};
function showAlerts(s){
 const box=document.getElementById('alerts');const messages=[];
 const add=(message,kind)=>messages.push({message,kind});
 if(s.fire_confirmed) add('FIRE DETECTED. '+(s.fire_lockout?
  'Response limit reached; inspect the area and water path immediately.':
  s.pump==='FIRE'?'Fire pump is commanded on.':
  s.fire_resting?'Fire pump is resting briefly before the next attempt.':
  'Fire pump is not spraying; inspect immediately.'),'danger');
 else if(s.fire_lockout) add('Fire response exhausted. Inspect the area, tank and pump. Other sensors remain active.','danger');
 if(s.water_fault) add('Watering stopped after bounded attempts. Check tank, pump, hose and sensor. Fire response still operates.','danger');
 else if(s.soil_valid&&s.soil_dry) add('Soil is dry. '+(s.auto_paused?
  'Automatic watering is paused.':'Watering will run when safe.'),'warn');
 const signature=JSON.stringify(messages);
 if(box.dataset.signature===signature)return;
 box.dataset.signature=signature;box.replaceChildren();
 messages.forEach(({message,kind})=>{const item=document.createElement('div');
  item.className='alert '+kind;item.textContent=message;box.appendChild(item)});
}
function showProbe(s){
 const ids=['ph','ec','nitrogen','phosphorus','potassium'];
 let good=0;
 s.probe.forEach((p,i)=>{
  if(p.fresh)good++;
  let value='No reading yet';
  if(p.raw!==null){
   const scaled=i===0?(p.raw/10).toFixed(1):String(p.raw);
   const unit=i===1?' µS/cm':i>1?' mg/kg':'';
   value=(p.fresh?'':'STALE · ')+scaled+unit+' (raw '+p.raw+')';
  }
  put(ids[i],value);
 });
 put('probetag',good===5?'5/5 LIVE':good+'/5 LIVE');
 document.getElementById('probetag').className='tag'+(good===5?'':' warn');
 put('probehealth',good===5?'All five registers replied recently.':
  'Missing or stale replies. Latest values are not safe to interpret as current.');
}
async function refresh(){
 if(busy)return;busy=true;
 try{
  const r=await fetch('/api/status',{cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  const s=await r.json();
  put('connection','Live · updated every 2 seconds');
  document.getElementById('connection').classList.remove('offline');
  put('ready',s.ready?'CONTROLLER READY':'STARTING');
  put('mode',s.emergency_stopped?'STOPPED':s.auto_paused?'MANUAL':'AUTO');
  put('pump',s.pump==='OFF'?'Pumps off':s.pump+' pump commanded on');
  put('waterstate',waterLabels[s.water_state]||s.water_state);
  put('firestate',fireLabels[s.fire_state]||s.fire_state);
  put('firebursts',s.fire_bursts+' / 3');
  put('waterbursts',s.water_bursts+' / 2');
  put('lockout',s.fire_lockout?'INSPECT · fire input must clear':'Clear');
  put('waterfault',s.water_fault?'CHECK WATER PATH':'Clear');
  put('servo',s.servo_attached?'Attached':'Detached');
  put('servoresult',!s.servo_attempted?'Not tried yet':
   s.last_servo_attach_ok?'Attached successfully':'Attach failed');
  put('event',(eventLabels[s.last_event]||s.last_event)+' · '+s.event_age_s+' s ago');
  put('soil',s.soil_valid?String(s.soil_adc)+' / 4095':'INVALID / ADC RAIL');
  put('dry',s.soil_dry?'YES':'NO');
  put('soiltag',s.soil_valid?(s.soil_dry?'DRY':'WET'):'CHECK SENSOR');
  document.getElementById('soiltag').className='tag'+(!s.soil_valid?' danger':s.soil_dry?' warn':'');
  put('fire',s.fire_confirmed?'CONFIRMED':s.fire_do===0?'Checking…':'Not detected');
  put('firedo',String(s.fire_do));
  put('firetag',s.fire_confirmed?'FIRE':'CLEAR');
  document.getElementById('firetag').className='tag'+(s.fire_confirmed?' danger':'');
  put('temp',s.temp_c===null?'INVALID':s.temp_c+' °C');
  put('rh',s.rh_percent===null?'INVALID':s.rh_percent+' %');
  put('mq6ao',s.mq6_ao_adc+' / 4095');
  put('mq6do',s.mq6_do+' (raw)');
  showProbe(s);showAlerts(s);
  put('led',s.led_letter);
  appendLog('pump='+s.pump+' water='+s.water_state+' soil='+s.soil_adc+
   ' dry='+Number(s.soil_dry)+' fire_DO='+s.fire_do+
   ' fire='+Number(s.fire_confirmed)+' fire_state='+s.fire_state+
   ' fire_attempts='+s.fire_bursts+' lockout='+Number(s.fire_lockout)+
   ' servo='+Number(s.servo_attached)+' temp='+s.temp_c+
   ' rh='+s.rh_percent+' mq6_AO='+s.mq6_ao_adc+
   ' mq6_DO='+s.mq6_do+' water_attempts='+s.water_bursts+
   ' water_fault='+Number(s.water_fault)+
   ' probe='+s.probe.map(p=>p.raw===null?'?':p.raw+(p.fresh?'':'!')).join('/')+
   ' event='+s.last_event);
 }catch(e){
  put('connection','Offline · check router and board power');
  document.getElementById('connection').classList.add('offline');
  appendLog('OFFLINE '+e.message);
 }finally{busy=false}
}
document.getElementById('copy').addEventListener('click',async()=>{
 const box=document.getElementById('log');
 try{
  if(navigator.clipboard&&window.isSecureContext)
   await navigator.clipboard.writeText(box.value);
  else{box.focus();box.select();if(!document.execCommand('copy'))throw Error('blocked')}
  put('loghint','Copied '+lines.length+' lines. Paste them into our chat.');
 }catch(e){box.focus();box.select();put('loghint','Text selected. Use your phone\'s Copy command.');}
});
document.querySelectorAll('[data-action]').forEach(button=>{
 button.addEventListener('click',async()=>{
  const action=button.dataset.action;
  const pin=document.getElementById('pin').value;
  const message=document.getElementById('controlmessage');
  if(!pin){message.textContent='Enter the control PIN first.';return}
  if(['fire_now','reset'].includes(action)&&
     !confirm(action==='reset'?'Confirm that you inspected the area, pump and water path.':
      'Start the fire pump and servo now, even without a fire sensor signal?'))return;
  button.disabled=true;
  try{
   const body=new URLSearchParams({action});
   const response=await fetch('/api/control',{method:'POST',
    headers:{'X-Avatar-Pin':pin,'Content-Type':'application/x-www-form-urlencoded'},
    body});
   const result=await response.json();
   message.textContent=response.ok?'Command queued. Watch the output event above.':
      (result.error||'Command failed.');
   if(response.ok)appendLog('CONTROL '+action+' queued');
   await refresh();
  }catch(e){message.textContent='Control request failed: '+e.message}
  finally{button.disabled=false}
 });
});
refresh();setInterval(refresh,2000);
</script></html>
)HTML";

void sendStatus() {
  StatusSnapshot snapshot;
  portENTER_CRITICAL(&statusMux);
  snapshot = publishedStatus;
  portEXIT_CRITICAL(&statusMux);
  char tempText[20] = "null";
  char rhText[20] = "null";
  if (snapshot.dhtValid) {
    snprintf(tempText, sizeof(tempText), "%.1f", snapshot.temperatureC);
    snprintf(rhText, sizeof(rhText), "%.1f", snapshot.humidityPercent);
  }
  const char *pump = snapshot.activePump == Pump::Fire ? "FIRE" :
                     snapshot.activePump == Pump::Irrigation ? "IRRIGATION" : "OFF";
  char probeJson[440] = "[";
  size_t used = 1;
  const uint32_t now = millis();
  for (uint8_t i = 0; i < PROBE_REGISTER_COUNT; ++i) {
    const ProbeReading &reading = snapshot.probe[i];
    char raw[8] = "null";
    char age[16] = "null";
    if (reading.hasValue) {
      snprintf(raw, sizeof(raw), "%u", reading.raw);
      snprintf(age, sizeof(age), "%lu",
               static_cast<unsigned long>((now - reading.lastGoodAt) / 1000));
    }
    const bool fresh = reading.hasValue &&
        reading.lastStatus == static_cast<uint8_t>(soilProbeRtu::Status::Valid) &&
        now - reading.lastGoodAt < PROBE_STALE_MS;
    const int n = snprintf(probeJson + used, sizeof(probeJson) - used,
        "%s{\"raw\":%s,\"age_s\":%s,\"fresh\":%s,\"last_status\":%u}",
        i ? "," : "", raw, age, fresh ? "true" : "false",
        reading.lastStatus);
    if (n < 0 || static_cast<size_t>(n) >= sizeof(probeJson) - used) {
      web.send(500, "text/plain", "Probe status overflow");
      return;
    }
    used += static_cast<size_t>(n);
  }
  probeJson[used++] = ']';
  probeJson[used] = '\0';

  char body[2200];
  const int written = snprintf(body, sizeof(body),
    "{\"ready\":%s,\"pump\":\"%s\",\"fire_lockout\":%s,\"water_fault\":%s,"
    "\"soil_adc\":%u,\"soil_valid\":%s,\"soil_dry\":%s,"
    "\"fire_do\":%d,\"fire_confirmed\":%s,"
    "\"temp_c\":%s,\"rh_percent\":%s,"
    "\"mq6_ao_adc\":%u,\"mq6_do\":%d,"
    "\"servo_attached\":%s,\"servo_attempted\":%s,"
    "\"last_servo_attach_ok\":%s,\"auto_paused\":%s,"
    "\"emergency_stopped\":%s,\"manual_test_running\":%s,"
    "\"servo_test_running\":%s,\"fire_bursts\":%u,"
    "\"water_bursts\":%u,\"fire_resting\":%s,"
    "\"water_soaking\":%s,\"fire_state\":\"%s\","
    "\"water_state\":\"%s\","
    "\"last_event\":\"%s\","
    "\"event_age_s\":%lu,\"led_letter\":\"%c\",\"probe\":%s}",
    snapshot.ready ? "true" : "false", pump,
    snapshot.fireLockout ? "true" : "false",
    snapshot.waterFault ? "true" : "false", snapshot.soilRaw,
    snapshot.soilValid ? "true" : "false", snapshot.soilDry ? "true" : "false",
    snapshot.fireRawLow ? 0 : 1,
    snapshot.fireConfirmed ? "true" : "false",
    tempText, rhText, snapshot.mq6Raw, snapshot.mq6Digital,
    snapshot.servoAttached ? "true" : "false",
    snapshot.servoAttempted ? "true" : "false",
    snapshot.lastServoAttachOk ? "true" : "false",
    snapshot.autoPaused ? "true" : "false",
    snapshot.emergencyStopped ? "true" : "false",
    snapshot.manualTestRunning ? "true" : "false",
    snapshot.servoTestRunning ? "true" : "false",
    snapshot.fireBursts, snapshot.waterBursts,
    snapshot.fireResting ? "true" : "false",
    snapshot.waterSoaking ? "true" : "false",
    snapshot.fireState, snapshot.waterState,
    snapshot.lastEvent,
    static_cast<unsigned long>((now - snapshot.lastEventAt) / 1000),
    snapshot.ledLetter, probeJson);
  if (written < 0 || static_cast<size_t>(written) >= sizeof(body)) {
    web.send(500, "text/plain", "Status overflow");
    return;
  }
  web.sendHeader("Cache-Control", "no-store");
  web.send(200, "application/json", body);
}

void networkTask(void *) {
  uint32_t lastReconnectAt = 0;
  bool announced = false;
  for (;;) {
    networkReady = WiFi.status() == WL_CONNECTED;
    if (networkReady && !announced) {
      Serial.print("AVATAR_LAN_IP=");
      Serial.println(WiFi.localIP());
      announced = true;
    } else if (!networkReady) {
      announced = false;
      const uint32_t now = millis();
      if (now - lastReconnectAt >= 10000) {
        WiFi.reconnect();
        lastReconnectAt = now;
      }
    }
    web.handleClient();
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

ManualAction parseManualAction(const String &name) {
  if (name == "pause") return ManualAction::PauseAuto;
  if (name == "resume") return ManualAction::ResumeAuto;
  if (name == "test_water") return ManualAction::TestWater;
  if (name == "test_fire") return ManualAction::TestFire;
  if (name == "test_servo") return ManualAction::TestServo;
  if (name == "water_now") return ManualAction::WaterNow;
  if (name == "fire_now") return ManualAction::FireNow;
  if (name == "stop_all") return ManualAction::StopAll;
  if (name == "reset") return ManualAction::ResetAfterInspection;
  return ManualAction::None;
}

bool validControlPin(const String &provided) {
  const size_t expected = strlen(AVATAR_CONTROL_PIN);
  size_t difference = provided.length() ^ expected;
  for (size_t i = 0; i < expected; ++i)
    difference |= static_cast<uint8_t>(provided.length() > i ?
        provided[i] : 0) ^ static_cast<uint8_t>(AVATAR_CONTROL_PIN[i]);
  return difference == 0;
}

void receiveControl() {
  if (!validControlPin(web.header("X-Avatar-Pin"))) {
    web.send(403, "application/json", "{\"error\":\"Control PIN required\"}");
    return;
  }
  if (!web.hasArg("action")) {
    web.send(400, "application/json", "{\"error\":\"Missing action\"}");
    return;
  }
  const ManualAction action = parseManualAction(web.arg("action"));
  if (action == ManualAction::None) {
    web.send(400, "application/json", "{\"error\":\"Unknown action\"}");
    return;
  }
  bool queued = false;
  portENTER_CRITICAL(&statusMux);
  if (pendingAction == ManualAction::None || action == ManualAction::StopAll) {
    pendingAction = action;
    queued = true;
  }
  portEXIT_CRITICAL(&statusMux);
  web.send(queued ? 202 : 409, "application/json",
           queued ? "{\"queued\":true}" : "{\"error\":\"Command busy\"}");
}

void startLanDashboard() {
  WiFi.mode(WIFI_STA);
  WiFi.setHostname("avatar-bench");
  WiFi.begin(AVATAR_WIFI_SSID, AVATAR_WIFI_PASSWORD);
  const char *headers[] = {"X-Avatar-Pin"};
  web.collectHeaders(headers, 1);
  web.on("/", HTTP_GET, []() { web.send_P(200, "text/html", PAGE); });
  web.on("/api/status", HTTP_GET, sendStatus);
  web.on("/api/control", HTTP_POST, receiveControl);
  web.onNotFound([]() { web.send(404, "text/plain", "Not found"); });
  web.begin();
  if (xTaskCreatePinnedToCore(networkTask, "avatar-local-page", 8192,
                              nullptr, 1, nullptr, 0) != pdPASS)
    networkReady = false;
}
} // namespace

void setup() {
  Serial.begin(115200);
  // Direction pins go LOW before Wi-Fi, sensor setup, or any other work.
  outputLow(FIRE_IN1_PIN);
  outputLow(FIRE_IN2_PIN);
  outputLow(WATER_IN3_PIN);
  outputLow(WATER_IN4_PIN);
  pumpsOff();
  outputLow(STATUS_LED_PIN);
  pinMode(FIRE_DO_PIN, INPUT);
  pinMode(MQ6_DO_PIN, INPUT);
  pinMode(SOIL_AO_PIN, INPUT);
  pinMode(MQ6_AO_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_AO_PIN, ADC_11db);
  analogSetPinAttenuation(MQ6_AO_PIN, ADC_11db);
  dht.begin();
  ledLetter = 'B';
  ledPattern = morsePattern(ledLetter);
  publishStatus(millis());
  startLanDashboard();
  if (xTaskCreatePinnedToCore(probeTask, "avatar-soil-probe", 4096,
                              nullptr, 1, nullptr, 0) != pdPASS)
    recordEvent("PROBE_TASK_FAILED", millis());
}

void loop() {
  const uint32_t now = millis();
  sampleFire(now);
  sampleSoil(now);
  sampleClimate(now);
  sampleMq6(now);
  consumeManualAction(now);
  updateOutputs(now);
  updateLed(now);
  publishStatus(now);
  delay(2);
}
