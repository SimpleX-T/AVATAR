#include <Arduino.h>

// Read-only commissioning sketch. It does not configure or drive any pump,
// motor-driver, or servo pins. GPIO34 has no internal pull-up/down: its reading
// is meaningful only when a verified 3.3 V-safe sensor output is connected.
constexpr uint8_t MOISTURE_ADC_PIN = 35;
constexpr uint8_t FIRE_DIGITAL_PIN = 34;
constexpr unsigned long SAMPLE_INTERVAL_MS = 500;

unsigned long lastSampleAt = 0;

void setup() {
  Serial.begin(115200);
  pinMode(MOISTURE_ADC_PIN, INPUT);
  pinMode(FIRE_DIGITAL_PIN, INPUT);
  analogReadResolution(12);
  Serial.println("ESP32 paired-input bench test: no actuator outputs configured");
  Serial.println("GPIO34 is untrusted until a stable, 3.3 V-safe signal is wired.");
}

void loop() {
  const unsigned long now = millis();
  if (now - lastSampleAt < SAMPLE_INTERVAL_MS) return;
  lastSampleAt = now;

  uint32_t moistureSum = 0;
  for (uint8_t i = 0; i < 16; ++i) {
    moistureSum += analogRead(MOISTURE_ADC_PIN);
  }
  const uint16_t moistureRaw = moistureSum / 16;
  const int fireRaw = digitalRead(FIRE_DIGITAL_PIN);

  Serial.printf("moisture_adc=%u fire_digital=%d\n", moistureRaw, fireRaw);
}
