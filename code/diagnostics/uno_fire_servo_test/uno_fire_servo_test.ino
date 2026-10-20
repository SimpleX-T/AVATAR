#include <Arduino.h>
#include <Servo.h>

// Uno R3 isolated fire-input -> servo test. No pump outputs.
constexpr uint8_t FIRE_PIN = 8;
constexpr uint8_t SERVO_PIN = 7;
constexpr uint8_t FIRE_ACTIVE_LEVEL = LOW; // This module reads 0 on fire, 1 at idle.
constexpr int SERVO_LEFT_DEG = 20;
constexpr int SERVO_RIGHT_DEG = 160;
constexpr unsigned long STEP_INTERVAL_MS = 20;
constexpr unsigned long REPORT_INTERVAL_MS = 500;

Servo testServo;
int angleDeg = SERVO_LEFT_DEG;
int direction = 1;
unsigned long lastStepAt = 0;
unsigned long lastReportAt = 0;

void setup() {
  pinMode(FIRE_PIN, INPUT); // Fire module must drive D8; never leave it floating.
  Serial.begin(115200);
  Serial.println(F("Uno fire/servo test: D8 LOW (fire) -> sweep D7, 20..160 degrees"));
}

void loop() {
  const unsigned long now = millis();
  const int fireRaw = digitalRead(FIRE_PIN);
  const bool active = fireRaw == FIRE_ACTIVE_LEVEL;

  if (active) {
    if (!testServo.attached()) {
      testServo.attach(SERVO_PIN);
      angleDeg = SERVO_LEFT_DEG;
      direction = 1;
      testServo.write(angleDeg);
      lastStepAt = now;
    }
    if (now - lastStepAt >= STEP_INTERVAL_MS) {
      lastStepAt = now;
      angleDeg += direction;
      if (angleDeg >= SERVO_RIGHT_DEG) {
        angleDeg = SERVO_RIGHT_DEG;
        direction = -1;
      } else if (angleDeg <= SERVO_LEFT_DEG) {
        angleDeg = SERVO_LEFT_DEG;
        direction = 1;
      }
      testServo.write(angleDeg);
    }
  } else if (testServo.attached()) {
    testServo.detach();
  }

  if (now - lastReportAt >= REPORT_INTERVAL_MS) {
    lastReportAt = now;
    Serial.print(F("fire_D8="));
    Serial.print(fireRaw);
    Serial.print(F(" sweep="));
    Serial.print(active ? F("ON") : F("OFF"));
    Serial.print(F(" angle="));
    Serial.println(angleDeg);
  }
}
