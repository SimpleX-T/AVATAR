#pragma once

// All timing values are milliseconds. Keeping them here makes field tuning
// possible without changing the control flow.
constexpr unsigned long SERIAL_BAUD = 115200;

// Sensor sampling
constexpr unsigned long CLIMATE_READ_INTERVAL = 2500;
constexpr unsigned long SOIL_READ_INTERVAL = 500;
constexpr unsigned long FIRE_SCAN_INTERVAL = 100;
constexpr unsigned long STATUS_PRINT_INTERVAL = 5000;

// Fire response
constexpr int FLAME_DETECTED_THRESHOLD = 1500;
constexpr unsigned long FIRE_CLEAR_HOLD_TIME = 5000;
constexpr unsigned long FIRE_MAX_RESPONSE_TIME = 30000;
constexpr int SERVO_LEFT = 30;
constexpr int SERVO_CENTER = 90;
constexpr int SERVO_RIGHT = 150;

// Irrigation. Most capacitive probes return a larger ADC value when dry.
constexpr int SOIL_DRY_THRESHOLD = 1800;
constexpr unsigned long SOIL_DRY_CONFIRM_TIME = 5000;
constexpr unsigned long IRRIGATION_RUN_TIME = 8000;
constexpr unsigned long IRRIGATION_COOLDOWN = 60000;

// Chemigation is intentionally manual-by-command in this prototype. Applying
// chemicals automatically from soil moisture alone would be unsafe.
constexpr unsigned long CHEMIGATION_DOSE_TIME = 5000;

// Motion deterrent
constexpr unsigned long MOTION_ALARM_TIME = 10000;
constexpr unsigned long MOTION_RETRIGGER_GUARD = 3000;
constexpr unsigned long BUZZER_TOGGLE_INTERVAL = 250;

// LDR raw threshold. It is reported for observation but does not gate safety.
constexpr int DAY_THRESHOLD = 1800;
