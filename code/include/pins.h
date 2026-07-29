#pragma once

// =========================
// Motion Detection
// =========================
constexpr uint8_t PIR_PIN = 14;

// =========================
// Fire Detection
// =========================
constexpr uint8_t FLAME_LEFT_PIN   = 34;
constexpr uint8_t FLAME_CENTER_PIN = 35;
constexpr uint8_t FLAME_RIGHT_PIN  = 32;

constexpr uint8_t FIRE_SERVO_PIN   = 18;
constexpr uint8_t FIRE_PUMP_PIN    = 25;
constexpr uint8_t FIRE_VALVE_PIN   = 21;

// =========================
// Irrigation
// =========================
constexpr uint8_t SOIL_SENSOR_PIN = 33;
constexpr uint8_t IRRIGATION_PUMP_PIN = 22;
constexpr uint8_t IRRIGATION_VALVE_PIN = 23;
constexpr uint8_t CHEMIGATION_PUMP_PIN = 19;
constexpr uint8_t CHEMIGATION_VALVE_PIN = 17;

// =========================
// Climate
// =========================
constexpr uint8_t DHT_PIN = 4;
constexpr uint8_t LDR_PIN = 36;

// =========================
// Alerts
// =========================
constexpr uint8_t BUZZER_PIN = 26;
constexpr uint8_t LED_PIN    = 27;
constexpr uint8_t ONBOARD_LED_PIN = 2;
