#pragma once

// Bench wiring carried into the modular target. Verify this map on the
// assembled board before enabling physical outputs. ADC inputs use ADC1.
constexpr uint8_t RS485_RX_PIN = 16;
constexpr uint8_t RS485_TX_PIN = 17;
constexpr uint8_t RS485_DIRECTION_PIN = 4;

constexpr uint8_t DHT_PIN = 13;
constexpr uint8_t FIRE_SENSOR_PIN = 34;
constexpr uint8_t SOIL_SENSOR_PIN = 35;
constexpr uint8_t MQ6_DO_PIN = 36;
constexpr uint8_t MQ6_AO_PIN = 39;

constexpr uint8_t FIRE_PUMP_IN1_PIN = 25;
constexpr uint8_t FIRE_PUMP_IN2_PIN = 26;
// ENA/ENB are physically jumpered HIGH on this particular bench build.
// Do not wire GPIO18/23 to those jumper-covered pins.
constexpr uint8_t IRRIGATION_PUMP_IN3_PIN = 32;
constexpr uint8_t IRRIGATION_PUMP_IN4_PIN = 33;
constexpr uint8_t FIRE_SERVO_PIN = 14;
constexpr uint8_t STATUS_LED_PIN = 22;
