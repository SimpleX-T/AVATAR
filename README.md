# Off-Grid Smart Agriculture Controller

ESP32 firmware for the Group A27H final-year project. The controller monitors
soil and climate conditions, irrigates dry soil, runs a motion-triggered
acoustic deterrent, and performs a directional local fire response.

## What was already present

- A PlatformIO project targeting the `esp32dev` Arduino board.
- Pin assignments for PIR, three flame sensors, DHT11, LDR, soil sensor,
  buzzer, LED, fire servo, fire pump, and fire valve.
- Working LED and fire pump/valve drivers.
- Empty placeholders for the remaining drivers and feature modules.

## How the completed firmware is organized

- `include/`: project-wide pins, tunable settings, data types, and system state.
- `src/drivers/`: direct hardware actions. Drivers do not make farm decisions.
- `src/modules/`: climate, irrigation, motion, and fire control rules.
- `src/utils/`: rollover-safe timing and readable serial status output.
- `src/main.cpp`: initializes everything and gives every module a short turn.

This separation matters: changing a pump pin should not change irrigation
policy, and changing an irrigation threshold should not change the pump driver.

## Safety decisions

1. No `delay()` calls are used. A delay in irrigation must not pause fire scans.
2. Every fluid operation has a maximum runtime.
3. Fire response stops irrigation and chemigation and has highest priority.
4. A 30-second fire-response timeout creates a lockout that requires inspection
   and a manual `r` command before another response can start.
5. Chemigation is not triggered by soil moisture. It requires the serial `c`
   command because chemical type, crop, concentration, and schedule are not
   known to this prototype.

## Pin map

| Function | ESP32 GPIO |
|---|---:|
| PIR motion sensor | 14 |
| Flame sensors (left/centre/right) | 34 / 35 / 32 |
| Fire servo | 18 |
| Fire pump / valve | 25 / 21 |
| Soil-moisture sensor | 33 |
| Irrigation pump / valve | 22 / 23 |
| Chemigation pump / valve | 19 / 17 |
| DHT11 | 4 |
| LDR | 36 |
| Buzzer / status LED | 26 / 27 |

GPIO 34, 35, and 36 are input-only pins, which is appropriate for the analogue
sensors connected to them.

## Serial controls

Open the monitor at 115200 baud:

```bash
pio device monitor
```

- `s`: print status now
- `c`: start one five-second chemigation dose
- `x`: stop irrigation, chemigation, and deterrent
- `r`: clear the fire-response safety lockout after inspection
- `?`: print command help

## Before connecting pumps

Do not power a pump, valve, or servo from an ESP32 GPIO. Use properly rated
MOSFET drivers, flyback protection for inductive loads, a shared ground, and a
separate actuator supply. Confirm whether each relay/MOSFET board is active-high;
the current driver assumes `HIGH = on`.

## Calibration

Update `include/config.h` after observing real serial readings:

- `SOIL_DRY_THRESHOLD`: read the probe in the actual dry and wet soil.
- `FLAME_DETECTED_THRESHOLD`: record readings with no flame and with a safe test
  source at the intended distance.
- `SERVO_LEFT`, `SERVO_CENTER`, `SERVO_RIGHT`: set safe mechanical limits before
  attaching a loaded suppressant mechanism.

## Build

```bash
cd code
pio run
```
