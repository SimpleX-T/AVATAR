# Project AVATAR

**Agricultural Vision and Automated Technology for Adaptive Response**

Project AVATAR is an IoT-based, off-grid **greenhouse farming research
prototype** for soil, climate, and atmospheric data collection, local
irrigation/fire response, and remote data access. It is a working system
prototype, not only a sensor-to-actuator demonstration. Raw probe registers
and gas readings remain research measurements until calibrated and validated.

The current physical build uses a 38-pin ESP32 and a 5S battery already stepped
down to 12 V, then to 5 V by a second buck converter. It includes a five-probe
RS-485 multi-parameter soil sensor, capacitive soil-moisture sensor, DHT11,
MQ-6 gas sensor, fire sensor,
servo, two pumps, an L298N board, an XY-MOS board, and the smaller pump's
included MOS controller. The soil-probe supplier has provided a **generic**
Modbus manual; its settings and enabled measurements still need verification
against this exact unit. Child sensor nodes and their LoRa/Wi-Fi links are
future expansion; sensors are wired to the head-node in this prototype.

**Implemented now:** modular ESP32 firmware with a capacitive soil sensor,
DHT11, divided MQ-6 inputs, read-only RS-485 soil registers, independent
bounded fire/water responses, and L298N pump outputs enabled in the current bench build;
a Node.js telemetry server and a browser dashboard; and optional server-side
private ThingSpeak publishing/reading, with two private research channels
configured locally; preconfigured Wi-Fi in the current bench build, an on-chip
farm profile, and a 12-hour printable research report. The original phone
provisioning portal still needs debugging. **Planned, not yet integrated:** durable
offline buffering,
QR-based claiming, remote child nodes, and physical pump
commissioning. See [the confirmed prototype architecture](docs/confirmed-system-architecture.md),
[the connection guide](docs/CONNECTIONS.md), and [the development roadmap](docs/production-roadmap.md).
For cloud setup, use [the ThingSpeak guide](docs/thingspeak-setup.md).
The [greenhouse setup and report guide](docs/greenhouse-onboarding-and-report.md)
separates compiled features from the hardware commissioning still required.
For the hosted dashboard and ESP32 cutover, follow
[the Render deployment guide](docs/render-deployment.md).

## Run the current software prototype

1. Start the server:

   ```bash
   cd server
   npm start
   ```

2. Copy and edit the ESP32 secrets:

   ```bash
   cd ../code
   cp include/secrets.example.h include/secrets.h
   ```

3. Set the computer LAN URL and device token in the ignored `secrets.h`.
   For this bench build, set `AVATAR_USE_PRECONFIGURED_WIFI` to `1` and supply
   the home 2.4 GHz Wi-Fi name and password there. Keep the file out of Git.

4. Upload and monitor:

   ```bash
   pio run --target upload
   pio device monitor
   ```

5. With the Node server running, power the ESP32. On that same computer, open
   `http://localhost:8787/` to see the dashboard. The ESP32 reconnects to
   Wi-Fi automatically and sends observations to the computer. The ESP32's
   own IP is not the dashboard address. Another device on the LAN would use
   the computer's IP on port `8787`, but Privy sign-in there currently needs
   HTTPS.

Without Privy credentials, the server stays in local demonstration mode. This
is still a developer workflow. The farm profile has been acknowledged by the
physical ESP32; sensor health and pump delivery need separate checks. QR claiming and
device-to-account ownership are not implemented.

## Enable operator sign-in with Privy

The current dashboard can use Privy email one-time passcodes. This is not yet
connected to device claiming or farm ownership; those are separate product
work still to design and implement.

1. Create a Privy app at `https://dashboard.privy.io`.
2. Enable **Email** under Authentication → Login methods.
3. Install and build the two SDK surfaces:

   ```bash
   cd server
   npm install
   npm --prefix client install
   npm run build:auth
   ```

4. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

5. Add `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, and a strong
   `PROJECT_AVATAR_DEVICE_TOKEN`, then restart `npm start`.

The App ID is intentionally exposed to the browser. The App Secret remains
server-only and must never be committed. Browser users receive an HTTP-only,
same-site session after the server verifies their Privy access token. The ESP32
continues to authenticate separately with its device token.

The current firmware settings are in `code/include/config.h`. Sensor inputs and
pump/servo outputs are enabled in the assembled bench target after the operator
confirmed the wiring. A successful build does not establish physical delivery
or sensor calibration. MQ-6 AO/DO and MAX485 RO must have their 5 V outputs
divided or level shifted before the ESP32.

```cpp
constexpr bool SIMULATION_MODE = false;
constexpr bool ENABLE_PUMP_OUTPUTS = true;
constexpr bool ENABLE_SERVO_OUTPUT = true;
constexpr bool ENABLE_FIRE_SENSOR_INPUT = true;
constexpr bool ENABLE_SOIL_MOISTURE_INPUT = false; // Probe is currently disconnected.
```

The pump and servo flags are separate; keep their physical safety bounds and
verify actual output before relying on them.

## Current prototype status

- The firmware targets an ESP32 DevKit. Its telemetry uses a fire sensor,
  DHT11, MQ-6 and raw pH/EC/N/P/K registers. The capacitive soil sensor is
  disconnected in this build: its reading is unavailable and automatic
  irrigation is disabled until the probe is wired and validated.
- The ESP32 reports to the hosted Node server every five seconds over a secure
  WebSocket when available, with verified HTTPS telemetry and command polling
  as fallback. The dashboard receives fresh server observations over its own
  WebSocket. The server archives a slower sample to two private ThingSpeak channels.
- Networking runs in a separate
  ESP32 task, so a slow HTTP request does not pause the faster local fire and
  pump control loop.
- The pin map in `code/include/pins.h` follows the bench inputs. The
  current LAN target was flashed and its server connection observed; physical
  water delivery remains unverified. L298N ENA/ENB stay jumpered on this particular build; GPIO18/23 are
  not used for the pump driver.

## Current firmware organization

- `include/`: project-wide pins, tunable settings, data types, and system state.
- `src/drivers/`: direct hardware actions. Drivers do not make farm decisions.
- `src/modules/`: climate/MQ-6, RS-485 soil probe, irrigation, and fire rules.
- `src/utils/`: rollover-safe timing and readable serial status output.
- `src/network/`: Wi-Fi, secure WebSocket telemetry/commands, and HTTPS fallback.
- `src/main.cpp`: initializes everything and gives every module a short turn.

The separation lets sensor drivers, farm rules, communications, and the
dashboard evolve independently as the prototype expands.

## Safety decisions

1. Local safety decisions must continue to work without internet access.
2. Pump operation needs explicit duration limits, cooldowns, and an emergency
   stop before real loads are used.
3. Fire response takes priority over irrigation, but the current hardware has
   one fire sensor and no independent valves; it cannot provide zoned fire
   suppression.
4. Pump PWM is a control input, not a verified measure of water flow or spray
   force. Calibrate using the actual pump, driver, supply, hose, and nozzle.
5. Dashboard commands must never be the only protection against unsafe local
   operation.
6. Pump and servo outputs are disabled until their wiring, current limits,
   physical emergency stop, and mechanical range are checked.

## Present firmware pin configuration

These assignments follow the working bench wiring; verify them on the final board.

| Function | ESP32 GPIO |
| --- | ---: |
| RS-485 RX, TX, direction | 16, 17, 4 |
| DHT11, fire sensor | 13, 34 |
| Capacitive moisture, MQ-6 digital, MQ-6 analog | 35, 36, 39 |
| Fire pump L298N IN1, IN2 (ENA jumper fitted) | 25, 26 |
| Irrigation pump L298N IN3, IN4 (ENB jumper fitted) | 32, 33 |
| Servo, external status LED | 14, 22 |

GPIO 34-39 are input-only. Check ADC availability and Wi-Fi constraints, sensor
voltage ranges, board pinout, and driver requirements before attaching analog
sensors or outputs. The soil probe uses RS-485 through the MAX485 board; its
protocol and register map still need confirmation.

## Serial controls

Open the monitor at 115200 baud:

```bash
pio device monitor
```

- `s`: print status now
- `x`: stop both pumps and latch safety lockouts
- `r`: clear safety lockouts after inspection when fire detection is clear
- `?`: print command help

In simulation mode, field scenarios are controlled from the dashboard.

## Before connecting pumps

Do not power a pump, valve, or servo from an ESP32 GPIO. Confirm the motor
driver's supported motor type, voltage/current limits, PWM behavior, and
protection before connecting either pump. Use suitable fusing, suppression for
inductive loads, correctly sized wiring, a separate actuator supply, and a
shared logic ground where required by the driver. Bench-test with the pump
disconnected first. The pump and nozzle arrangement must be tested for actual
flow and reach; PWM percentage alone does not establish those values.
The 5S battery's discharge protection must also be confirmed; the existing
12 V and 5 V bucks regulate voltage but do not by themselves protect its cells.
Both pumps have spun directly at 3.3 V and 5 V, but their ratings and
performance through the L298N are unverified. The L298N's two outputs share
one `VS` motor-supply rail and it drops significant voltage under load; its
`5V-EN` jumper commonly enables a logic regulator, **not a 5 V pump output**.
The modular target keeps its outputs disabled pending on-board integration
testing. The XY-MOS is not a servo position controller. A three-wire
servo needs a separate regulated supply at its rated voltage (commonly around
5 V), adequate peak current, common ground, and a GPIO position signal. See
the [pump/driver evidence](docs/temu-pump-driver-research.md) and the
[sensor-input-first wiring sequence](docs/esp32-paired-loop-bench-bringup.md).

## Calibration

Calibrate every sensor against its data sheet and measurements in the intended
soil/air. Record units, range, sampling interval, location, and calibration
date. Determine the fire sensor's output type and safe test method. Set servo
limits mechanically before mounting the spray assembly. Do not label raw ADC
values as NPK, EC, moisture percentage, gas concentration, or temperature
without the appropriate conversion and calibration.

## Build

```bash
cd code
pio run
```

## Network security boundary

Privy can protect browser access when configured, but the included file-backed
server is still for development and demonstrations. ThingSpeak is configured
for this prototype, but secure device claiming, account-to-device ownership,
and a field-grade offline queue are not present yet. Before public deployment,
add HTTPS, durable storage, rate limits,
unique revocable device credentials, audit logging, ownership checks, and a
documented recovery process. Do not forward port `8787` from a router.

## Direct Wi-Fi fallback

For deadline demonstrations, bypass phone provisioning by setting
`AVATAR_USE_PRECONFIGURED_WIFI` to `1` in the ignored `code/include/secrets.h`.
Set `WIFI_SSID` and `WIFI_PASSWORD` in that same file, using
`code/include/secrets.example.h` as the reference. Upload the firmware; it joins
that network automatically at boot without opening the setup access point.
Existing on-chip Wi-Fi settings are retained. Set the flag back to `0` and
upload again to restore the phone provisioning flow.

This fallback does not resolve the outstanding phone provisioning timeout.
Wi-Fi connection and delivery to the dashboard server require separate checks.

## Standalone field test (21 October 2026)

The integrated ESP32 build now uses the operator-confirmed bench wiring with
pump and servo outputs enabled. Automatic Wi-Fi uses the ignored local
`secrets.h` fallback. Fire and irrigation retain bounded bursts, sensor checks,
independent recovery, and fire priority. Physical performance must still be
observed on the assembled system; a firmware build is not a pump-delivery test.

Local control runs on the ESP32 without this computer. The browser dashboard,
authentication, research reports, and current ThingSpeak publishing bridge
still run on the Node.js server. Keep that server on for browser/cloud access.
The ESP32 reconnects when Wi-Fi or the server returns.

The field console separates fresh device reports, valid sensor observations,
command acknowledgements, and cloud upload state. Setup follows the actual
reporting device ID, then waits for the ESP32 to acknowledge the matching
profile. A connected device with invalid sensors is not displayed as a healthy
commissioned farm.

Run `npm --prefix server run build:figure` to regenerate the Anatomy greenhouse
schematic, `npm --prefix server run build:auth` for the sign-in page, and
`npm --prefix server test` for model and isolated setup-flow tests.
