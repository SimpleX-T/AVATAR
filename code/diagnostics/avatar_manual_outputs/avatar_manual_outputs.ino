#include <Arduino.h>
#include <ESP32Servo.h>

// Manual actuator bench test for the classic 38-pin ESP32 board.
// This sketch does not read sensors or start any output automatically.
// Each single-letter serial command starts exactly one short test.
namespace {
constexpr uint8_t FIRE_IN1_PIN = 25;
constexpr uint8_t FIRE_IN2_PIN = 26;
constexpr uint8_t WATER_IN3_PIN = 32;
constexpr uint8_t WATER_IN4_PIN = 33;
constexpr uint8_t SERVO_SIGNAL_PIN = 14;

// ENA and ENB stay jumpered on the L298N. Do not wire GPIO18/23 to them.
constexpr uint32_t PUMP_TEST_MS = 3000;
constexpr uint32_t SERVO_STEP_MS = 35;
constexpr uint32_t SERVO_SETTLE_MS = 500;
constexpr uint32_t SERVO_MAX_TEST_MS = 6000;
constexpr int SERVO_MIN_DEG = 45;
constexpr int SERVO_MID_DEG = 90;
constexpr int SERVO_MAX_DEG = 135;

enum class Test : uint8_t { None, Irrigation, Fire, Servo };
enum class ServoPhase : uint8_t { ToMin, ToMax, ToMid, Settle };

Servo servo;
Test activeTest = Test::None;
ServoPhase servoPhase = ServoPhase::ToMin;
uint32_t testStartedAt = 0;
uint32_t lastServoStepAt = 0;
uint32_t servoSettlingAt = 0;
int servoAngle = SERVO_MID_DEG;

void setOutputLow(uint8_t pin) {
  digitalWrite(pin, LOW);
  pinMode(pin, OUTPUT);
}

void stopAll(const char *reason) {
  digitalWrite(FIRE_IN1_PIN, LOW);
  digitalWrite(FIRE_IN2_PIN, LOW);
  digitalWrite(WATER_IN3_PIN, LOW);
  digitalWrite(WATER_IN4_PIN, LOW);
  if (servo.attached()) servo.detach();
  if (activeTest != Test::None) Serial.printf("[STOP] %s\n", reason);
  activeTest = Test::None;
}

void startPump(Test requested, uint32_t now) {
  if (activeTest != Test::None) {
    Serial.println("[BUSY] Send x to stop the current test first.");
    return;
  }
  stopAll("idle");
  if (requested == Test::Fire) {
    digitalWrite(FIRE_IN1_PIN, HIGH);
    activeTest = Test::Fire;
    Serial.println("[START] FIRE channel: GPIO25 HIGH, GPIO26 LOW; 3 s maximum.");
  } else {
    digitalWrite(WATER_IN3_PIN, HIGH);
    activeTest = Test::Irrigation;
    Serial.println("[START] IRRIGATION channel: GPIO32 HIGH, GPIO33 LOW; 3 s maximum.");
  }
  testStartedAt = now;
}

void startServo(uint32_t now) {
  if (activeTest != Test::None) {
    Serial.println("[BUSY] Send x to stop the current test first.");
    return;
  }
  stopAll("idle");
  servo.setPeriodHertz(50);
  servo.attach(SERVO_SIGNAL_PIN, 1000, 2000);
  if (!servo.attached()) {
    Serial.println("[ERROR] Servo attach failed; no test started.");
    return;
  }
  servoAngle = SERVO_MID_DEG;
  servoPhase = ServoPhase::ToMin;
  servo.write(servoAngle);
  activeTest = Test::Servo;
  testStartedAt = now;
  lastServoStepAt = now;
  Serial.println("[START] SERVO only: GPIO14, 90 -> 45 -> 135 -> 90 degrees.");
}

void updateServo(uint32_t now) {
  if (now - testStartedAt >= SERVO_MAX_TEST_MS) {
    stopAll("servo maximum run time");
    return;
  }
  if (servoPhase == ServoPhase::Settle) {
    if (now - servoSettlingAt >= SERVO_SETTLE_MS)
      stopAll("servo test complete");
    return;
  }
  if (now - lastServoStepAt < SERVO_STEP_MS) return;
  lastServoStepAt = now;

  switch (servoPhase) {
    case ServoPhase::ToMin:
      servoAngle -= 2;
      if (servoAngle <= SERVO_MIN_DEG) {
        servoAngle = SERVO_MIN_DEG;
        servoPhase = ServoPhase::ToMax;
      }
      break;
    case ServoPhase::ToMax:
      servoAngle += 2;
      if (servoAngle >= SERVO_MAX_DEG) {
        servoAngle = SERVO_MAX_DEG;
        servoPhase = ServoPhase::ToMid;
      }
      break;
    case ServoPhase::ToMid:
      servoAngle -= 2;
      if (servoAngle <= SERVO_MID_DEG) {
        servoAngle = SERVO_MID_DEG;
        servoPhase = ServoPhase::Settle;
        servoSettlingAt = now;
      }
      break;
    case ServoPhase::Settle:
      break;
  }
  servo.write(servoAngle);
}

void printStatus() {
  const char *name = "IDLE";
  if (activeTest == Test::Irrigation) name = "IRRIGATION";
  else if (activeTest == Test::Fire) name = "FIRE";
  else if (activeTest == Test::Servo) name = "SERVO";
  Serial.printf("[STATUS] %s\n", name);
}

void handleSerial(uint32_t now) {
  while (Serial.available()) {
    const char command = static_cast<char>(Serial.read());
    if (command == 'x' || command == 'X') stopAll("user stop");
    else if (command == 'i' || command == 'I') startPump(Test::Irrigation, now);
    else if (command == 'f' || command == 'F') startPump(Test::Fire, now);
    else if (command == 'v' || command == 'V') startServo(now);
    else if (command == 's' || command == 'S') printStatus();
    else if (command == '?')
      Serial.println("Commands: i=irrigation, f=fire pump, v=servo only, x=STOP, s=status");
    else if (command != '\r' && command != '\n' && command != ' ')
      Serial.println("[ERROR] Unknown command. Send ? for help.");
  }
}
} // namespace

void setup() {
  Serial.begin(115200);
  setOutputLow(FIRE_IN1_PIN);
  setOutputLow(FIRE_IN2_PIN);
  setOutputLow(WATER_IN3_PIN);
  setOutputLow(WATER_IN4_PIN);
  stopAll("boot");
  Serial.println("\nProject AVATAR manual actuator test");
  Serial.println("No sensors, Wi-Fi, automatic triggers, or separate arm command.");
  Serial.println("ENA/ENB jumpers stay fitted; GPIO18/23 stay disconnected.");
  Serial.println("Commands: i=irrigation, f=fire pump, v=servo only, x=STOP, s=status");
}

void loop() {
  const uint32_t now = millis();
  handleSerial(now);
  if ((activeTest == Test::Irrigation || activeTest == Test::Fire) &&
      now - testStartedAt >= PUMP_TEST_MS)
    stopAll("pump 3 s time limit");
  if (activeTest == Test::Servo) updateServo(now);
  delay(2);
}
