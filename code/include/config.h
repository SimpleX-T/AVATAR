#pragma once

#include <stdint.h>
#include "field_policy.h"

// All timing values are milliseconds. Keeping them here makes field tuning
// possible without changing the control flow.
constexpr unsigned long SERIAL_BAUD = 115200;

// The integrated target defaults to safe output-off until its own pin mapping
// and power rail are commissioned. The separate bench sketch is unchanged.
constexpr bool SIMULATION_MODE = false;
constexpr bool ENABLE_PUMP_OUTPUTS = false;
constexpr bool ENABLE_SERVO_OUTPUT = false;
constexpr bool ENABLE_FIRE_SENSOR_INPUT = true;
constexpr bool ENABLE_SOIL_MOISTURE_INPUT = true;
constexpr bool ENABLE_MQ6_INPUT = true; // Both AO and DO must be divided to <=3.3 V.
constexpr bool ENABLE_RS485_PROBE = true; // MAX485 RO must be level shifted.

// Network
constexpr unsigned long WIFI_RETRY_INTERVAL = 30000;
constexpr unsigned long TELEMETRY_INTERVAL = 60000;
constexpr unsigned long COMMAND_POLL_INTERVAL = 2000;
constexpr unsigned long WEBSOCKET_RECONNECT_INTERVAL = 3000;
constexpr unsigned long HTTP_TIMEOUT = 3000;

// Sensor sampling
constexpr unsigned long CLIMATE_READ_INTERVAL = 3000;
constexpr unsigned long SOIL_READ_INTERVAL = 500;
constexpr unsigned long MQ6_READ_INTERVAL = 2000;
constexpr unsigned long FIRE_SCAN_INTERVAL = 50;
constexpr unsigned long STATUS_PRINT_INTERVAL = 5000;

// Fire response
// Bench samples suggest active LOW, but stable idle and false triggers still
// need controlled validation before enabling this input for automatic action.
constexpr uint8_t FIRE_SENSOR_ACTIVE_LEVEL = 0;
constexpr unsigned long FIRE_CONFIRM_TIME = 300;
constexpr unsigned long FIRE_CLEAR_HOLD_TIME = FIRE_CLEAR_MS;
constexpr unsigned long FIRE_IDLE_STARTUP_TIME = 1000;
constexpr unsigned long FIRE_MAX_RESPONSE_TIME = FIRE_BURST_MS;
constexpr unsigned long FIRE_REST_TIME = FIRE_REST_MS;
constexpr unsigned long FIRE_REARM_IDLE_TIME = FIRE_REARM_IDLE_MS;
constexpr int SERVO_LEFT = 45;
constexpr int SERVO_CENTER = 90;
constexpr int SERVO_RIGHT = 135;
constexpr unsigned long FIRE_SWEEP_STEP_INTERVAL = 35;
constexpr int FIRE_SWEEP_STEP_DEGREES = 2;

// Calibrated for the current capacitive sensor: wet median 1983, dry 3201.
// Recalibrate if the sensor, supply or installed soil conditions change.
constexpr int SOIL_DRY_THRESHOLD = 2928;
constexpr int SOIL_WET_THRESHOLD = 2408;
constexpr unsigned long SOIL_DRY_CONFIRM_TIME = 3000;
constexpr unsigned long IRRIGATION_RUN_TIME = WATER_BURST_MS;
constexpr unsigned long IRRIGATION_SOAK_TIME = WATER_SOAK_MS;
constexpr uint8_t IRRIGATION_MAX_BURSTS = WATER_MAX_BURSTS;
constexpr unsigned long IRRIGATION_COOLDOWN = 60000;
