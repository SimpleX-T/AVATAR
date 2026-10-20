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

**Implemented now:** modular ESP32 firmware with the calibrated capacitive sensor,
DHT11, divided MQ-6 inputs, read-only RS-485 soil registers, independent
bounded fire/water responses, and two disabled-by-default L298N pump outputs;
a Node.js telemetry server and a browser dashboard; and optional server-side
private ThingSpeak publishing/reading, with two private research channels
configured locally; protected first-boot Wi-Fi setup, NVS-stored credentials
and farm profile, and a 12-hour printable research report. Provisioning
compiles but awaits physical commissioning. **Planned, not yet integrated:** durable
offline buffering,
QR-based claiming, remote child nodes, and physical pump
commissioning. See [the confirmed prototype architecture](docs/confirmed-system-architecture.md),
[the connection guide](docs/CONNECTIONS.md), and [the development roadmap](docs/production-roadmap.md).
For cloud setup, use [the ThingSpeak guide](docs/thingspeak-setup.md).
The [greenhouse setup and report guide](docs/greenhouse-onboarding-and-report.md)
separates compiled features from the hardware commissioning still required.

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

3. Set the computer LAN URL and device token in `secrets.h`. Home Wi-Fi is
   entered through the protected ESP32 setup page after flashing, not stored
   in this source file.

4. Upload and monitor:

   ```bash
   pio run --target upload
   pio device monitor
   ```

5. On first boot, read the generated setup Wi-Fi name and password at 115200
   baud; label the unit, then visit `http://192.168.4.1` from a phone on that
   Wi-Fi. After connecting the ESP32 to the home network, open
   `http://localhost:8787` on the server computer to name the greenhouse.

Without Privy credentials, the server stays in local demonstration mode. This
is still a developer workflow. The farm profile and Wi-Fi provisioning are
implemented but not yet commissioned on physical hardware. QR claiming and
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

The current firmware settings are in `code/include/config.h`. Sensor inputs
are enabled in the integrated target; pump/servo outputs remain disabled there
until that target is commissioned. A successful build does not establish hardware
readiness. MQ-6 AO/DO and MAX485 RO must have their 5 V outputs divided or level
shifted before the ESP32.

```cpp
constexpr bool SIMULATION_MODE = false;
constexpr bool ENABLE_PUMP_OUTPUTS = false;
constexpr bool ENABLE_SERVO_OUTPUT = false;
constexpr bool ENABLE_FIRE_SENSOR_INPUT = true;
constexpr bool ENABLE_SOIL_MOISTURE_INPUT = true;
```

The pump and servo flags are separate. Set each to `true` only after its
electrical and mechanical commissioning steps pass.

## Current prototype status

- The firmware targets an ESP32 DevKit. Its telemetry uses one fire sensor,
  one capacitive soil sensor, DHT11, MQ-6 and raw pH/EC/N/P/K registers.
- Firmware telemetry goes to the Node server over the current LAN HTTP/WebSocket
  path. When configured, the server writes two private ThingSpeak channels and
  the dashboard reads their recorded feeds through a protected server route.
- The local telemetry interval is 60 seconds. Networking runs in a separate
  ESP32 task, so a slow HTTP request does not pause the faster local fire and
  pump control loop.
- The pin map in `code/include/pins.h` follows the proven bench inputs. The
  integrated target has not yet been flashed and re-tested on the assembled
  board. L298N ENA/ENB stay jumpered on this particular build; GPIO18/23 are
  not used for the pump driver.

## Current firmware organization

- `include/`: project-wide pins, tunable settings, data types, and system state.
- `src/drivers/`: direct hardware actions. Drivers do not make farm decisions.
- `src/modules/`: climate/MQ-6, RS-485 soil probe, irrigation, and fire rules.
- `src/utils/`: rollover-safe timing and readable serial status output.
- `src/network/`: Wi-Fi, HTTP telemetry, and remote-command polling.
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
